import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type * as ort from 'onnxruntime-common';
import { getRuntime } from './runtime';
import { SentencePieceTokenizer } from './sentencepiece';
import { parseNpyFloat32 } from './npy';
import { parseSafetensors } from './safetensors';
import { prepareText } from './text';
import { applyOutputs, initState, stateFromVoice, type ModelState } from './state';
import { resample } from './resample';
import type { PocketBundle, PocketTensor } from './types';

const MAX_FRAMES = 500;
const DEFAULT_FLOW_STEPS = 8;
const DEFAULT_TEMPERATURE = 0.3;
const EOS_LOGIT_THRESHOLD = -4;
const FIRST_DECODE_FRAMES = 3;
const DECODE_FRAMES = 12;
const CHUNK_GAP_SECONDS = 0.25;

const SESSION_FILES = {
    textConditioner: 'text_conditioner_int8.onnx',
    flowMain: 'flow_lm_main_int8.onnx',
    flow: 'flow_lm_flow_int8.onnx',
    decoder: 'mimi_decoder_int8.onnx',
    encoder: 'mimi_encoder_int8.onnx',
} as const;

export type VoiceSource =
    | { kind: 'embedding'; key: string; file: string }
    | { kind: 'audio'; key: string; samples: Float32Array; sampleRate: number };

export interface PocketOptions {
    /** Euler steps for the flow solver: more is closer to the text, and proportionally slower. */
    flowSteps?: number;
    temperature?: number;
}

export interface PocketAudio {
    samples: Float32Array;
    sampleRate: number;
}

type Sessions = Record<keyof typeof SESSION_FILES, ort.InferenceSession>;

const tensor = (dtype: 'float32' | 'int64' | 'bool', data: unknown, shape: number[]) =>
    new (getRuntime().Tensor)(dtype, data as never, shape);

function gaussian(size: number, deviation: number): Float32Array {
    const values = new Float32Array(size);
    for (let i = 0; i < size; i++) {
        let u = 0;
        let v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        values[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * deviation;
    }
    return values;
}

function concat(parts: Float32Array[]): Float32Array {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const part of parts) {
        merged.set(part, offset);
        offset += part.length;
    }
    return merged;
}

export class PocketEngine {
    private readonly voiceStates = new Map<string, ModelState>();

    private constructor(
        private readonly bundle: PocketBundle,
        private readonly tokenizer: SentencePieceTokenizer,
        private readonly sessions: Sessions,
        private readonly bosBeforeVoice: PocketTensor | null,
    ) {}

    static async load(modelDir: string): Promise<PocketEngine> {
        const bundle = JSON.parse(
            await readFile(join(modelDir, 'bundle.json'), 'utf-8'),
        ) as PocketBundle;

        const tokenizerBytes = await readFile(join(modelDir, bundle.tokenizer_file));
        const tokenizer = SentencePieceTokenizer.fromModel(toArrayBuffer(tokenizerBytes));

        const entries = await Promise.all(
            Object.entries(SESSION_FILES).map(
                async ([name, file]) =>
                    [
                        name,
                        await getRuntime().InferenceSession.create(join(modelDir, file)),
                    ] as const,
            ),
        );

        let bos: PocketTensor | null = null;
        if (bundle.bos_before_voice_file) {
            const raw = await readFile(join(modelDir, bundle.bos_before_voice_file)).catch(
                () => null,
            );
            if (raw) bos = parseNpyFloat32(toArrayBuffer(raw));
        }

        return new PocketEngine(bundle, tokenizer, Object.fromEntries(entries) as Sessions, bos);
    }

    get sampleRate(): number {
        return this.bundle.sample_rate;
    }

    async synthesize(
        text: string,
        voice: VoiceSource,
        options: PocketOptions = {},
    ): Promise<PocketAudio> {
        const flowSteps = Math.max(1, Math.trunc(options.flowSteps ?? DEFAULT_FLOW_STEPS));
        const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
        const { chunks, framesAfterEos } = prepareText(text, this.bundle, this.tokenizer);
        if (chunks.length === 0) {
            return { samples: new Float32Array(0), sampleRate: this.bundle.sample_rate };
        }

        const baseState = await this.voiceState(voice);
        const audio: Float32Array[] = [];

        for (const [index, chunk] of chunks.entries()) {
            if (index > 0) audio.push(this.silence());
            audio.push(
                await this.speakChunk(chunk, baseState, framesAfterEos, flowSteps, temperature),
            );
        }

        return { samples: concat(audio), sampleRate: this.bundle.sample_rate };
    }

    dispose(): void {
        for (const session of Object.values(this.sessions)) {
            void session.release?.();
        }
        this.voiceStates.clear();
    }

    private silence(): Float32Array {
        return new Float32Array(Math.floor(CHUNK_GAP_SECONDS * this.bundle.sample_rate));
    }

    private async voiceState(voice: VoiceSource): Promise<ModelState> {
        const cached = this.voiceStates.get(voice.key);
        if (cached) return cached;

        const state =
            voice.kind === 'embedding'
                ? stateFromVoice(
                      parseSafetensors(toArrayBuffer(await readFile(voice.file))),
                      this.bundle.flow_lm_state_manifest,
                      tensor,
                  )
                : await this.stateFromAudio(voice.samples, voice.sampleRate);

        this.voiceStates.set(voice.key, state);
        return state;
    }

    /** Zero-shot cloning: the codec turns a recording into the embedding the model conditions on. */
    private async stateFromAudio(samples: Float32Array, sampleRate: number): Promise<ModelState> {
        const prompt = resample(samples, sampleRate, this.bundle.sample_rate);
        const encoded = await this.sessions.encoder.run({
            audio: tensor('float32', prompt, [1, 1, prompt.length]),
        });
        const embedding = encoded[this.sessions.encoder.outputNames[0]];
        const dims = embedding.dims.slice(-2);

        let data = embedding.data as Float32Array;
        let shape = [1, dims[0], dims[1]];

        if (this.bundle.insert_bos_before_voice && this.bosBeforeVoice) {
            const bos = this.bosBeforeVoice;
            const merged = new Float32Array(bos.data.length + data.length);
            merged.set(bos.data, 0);
            merged.set(data, bos.data.length);
            data = merged;
            shape = [1, shape[1] + (bos.shape.at(-2) ?? 1), shape[2]];
        }

        const state = initState(this.bundle.flow_lm_state_manifest, tensor);
        const result = await this.sessions.flowMain.run({
            sequence: this.emptySequence(),
            text_embeddings: tensor('float32', data, shape),
            ...state,
        });
        applyOutputs(state, result, this.bundle.flow_lm_state_manifest);
        return state;
    }

    private emptySequence(): ort.Tensor {
        return tensor('float32', new Float32Array(0), [1, 0, this.bundle.latent_dim]);
    }

    private async speakChunk(
        chunk: string,
        baseState: ModelState,
        framesAfterEos: number,
        flowSteps: number,
        temperature: number,
    ): Promise<Float32Array> {
        const schedule = Array.from({ length: flowSteps }, (_, step) => ({
            s: tensor('float32', Float32Array.of(step / flowSteps), [1, 1]),
            t: tensor('float32', Float32Array.of((step + 1) / flowSteps), [1, 1]),
        }));
        const { latent_dim: latentDim, conditioning_dim: conditioningDim } = this.bundle;
        const flowState: ModelState = { ...baseState };
        const mimiState = initState(this.bundle.mimi_state_manifest, tensor);
        const emptyText = tensor('float32', new Float32Array(0), [1, 0, conditioningDim]);

        const ids = this.tokenizer.encode(chunk);
        const embeddings = await this.sessions.textConditioner.run({
            token_ids: tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
        });
        const textEmbedding = this.asBatched(
            embeddings[this.sessions.textConditioner.outputNames[0]],
        );

        applyOutputs(
            flowState,
            await this.sessions.flowMain.run({
                sequence: this.emptySequence(),
                text_embeddings: textEmbedding,
                ...flowState,
            }),
            this.bundle.flow_lm_state_manifest,
        );

        const latents: Float32Array[] = [];
        const audio: Float32Array[] = [];
        let decoded = 0;
        let eosStep: number | null = null;
        let latent = tensor('float32', new Float32Array(latentDim).fill(Number.NaN), [
            1,
            1,
            latentDim,
        ]);

        for (let step = 0; step < MAX_FRAMES; step++) {
            const result = await this.sessions.flowMain.run({
                sequence: latent,
                text_embeddings: emptyText,
                ...flowState,
            });

            const eosLogit = (result.eos_logit.data as Float32Array)[0];
            if (eosLogit > EOS_LOGIT_THRESHOLD && eosStep === null) eosStep = step;
            const finished = eosStep !== null && step >= eosStep + framesAfterEos;

            const sampled = gaussian(latentDim, Math.sqrt(temperature));
            for (const { s, t } of schedule) {
                const flow = await this.sessions.flow.run({
                    c: result.conditioning,
                    s,
                    t,
                    x: tensor('float32', sampled, [1, latentDim]),
                });
                const direction = flow.flow_dir.data as Float32Array;
                for (let i = 0; i < latentDim; i++) sampled[i] += direction[i] / flowSteps;
            }

            latents.push(Float32Array.from(sampled));
            latent = tensor('float32', Float32Array.from(sampled), [1, 1, latentDim]);
            applyOutputs(flowState, result, this.bundle.flow_lm_state_manifest);

            const pending = latents.length - decoded;
            const batch = finished
                ? pending
                : pending >= (decoded === 0 ? FIRST_DECODE_FRAMES : DECODE_FRAMES)
                  ? decoded === 0
                      ? FIRST_DECODE_FRAMES
                      : DECODE_FRAMES
                  : 0;

            if (batch > 0) {
                audio.push(await this.decode(latents, decoded, batch, mimiState));
                decoded += batch;
            }
            if (finished) break;
        }

        return concat(audio);
    }

    private async decode(
        latents: Float32Array[],
        from: number,
        count: number,
        mimiState: ModelState,
    ): Promise<Float32Array> {
        const latentDim = this.bundle.latent_dim;
        const block = new Float32Array(count * latentDim);
        for (let i = 0; i < count; i++) block.set(latents[from + i], i * latentDim);

        const result = await this.sessions.decoder.run({
            latent: tensor('float32', block, [1, count, latentDim]),
            ...mimiState,
        });
        applyOutputs(mimiState, result, this.bundle.mimi_state_manifest);

        return Float32Array.from(result[this.sessions.decoder.outputNames[0]].data as Float32Array);
    }

    private asBatched(value: ort.Tensor): ort.Tensor {
        if (value.dims.length !== 2) return value;
        return tensor('float32', value.data as Float32Array, [1, value.dims[0], value.dims[1]]);
    }
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
    return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
}
