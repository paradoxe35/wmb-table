import { access, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import log from 'electron-log';
import type { TtsProvider } from './provider';
import type {
    TtsProviderType,
    TtsProviderInfo,
    TtsProviderSettings,
    TtsSynthesizeRequest,
    TtsSynthesizeResult,
    TtsVoice,
} from '@shared/tts.types';
import { getTtsModelsDir } from '@main/lib/app-paths';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'ja', 'zh', 'hi', 'it', 'pt'];

// Voice prefix → language code mapping
const VOICE_LANG_MAP: Record<string, string[]> = {
    af: ['en'], // American English, Female
    am: ['en'], // American English, Male
    bf: ['en'], // British English, Female
    bm: ['en'], // British English, Male
    ef: ['es'], // Spanish, Female
    em: ['es'], // Spanish, Male
    ff: ['fr'], // French, Female
    fm: ['fr'], // French, Male
    hf: ['hi'], // Hindi, Female
    hm: ['hi'], // Hindi, Male
    if: ['it'], // Italian, Female
    im: ['it'], // Italian, Male
    jf: ['ja'], // Japanese, Female
    jm: ['ja'], // Japanese, Male
    pf: ['pt'], // Portuguese, Female
    pm: ['pt'], // Portuguese, Male
    zf: ['zh'], // Chinese, Female
    zm: ['zh'], // Chinese, Male
};

function getVoiceLanguage(voiceId: string): string[] {
    const prefix = voiceId.substring(0, 2);
    return VOICE_LANG_MAP[prefix] ?? ['en'];
}

function getVoiceGender(voiceId: string): 'male' | 'female' {
    return voiceId[1] === 'm' ? 'male' : 'female';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let kokoroInstance: any = null;
let modelReady = false;

export class KokoroProvider implements TtsProvider {
    readonly type: TtsProviderType = 'kokoro';
    private voiceId = 'af_heart';
    private cachedVoices: string[] = [];

    async getInfo(): Promise<TtsProviderInfo> {
        const voices = this.getVoiceList();
        return {
            type: 'kokoro',
            locality: 'local',
            displayName: 'Kokoro TTS',
            supportedLanguages: SUPPORTED_LANGUAGES,
            supportsVoiceCloning: false,
            supportsStreaming: true,
            voices,
            defaultModel: MODEL_ID,
            availableModels: [MODEL_ID],
            requiresApiKey: false,
            requiresModelDownload: true,
            modelDownloaded: await this.isModelReady(),
        };
    }

    supportsLanguage(langCode: string): boolean {
        const code = langCode.split('-')[0].toLowerCase();
        return SUPPORTED_LANGUAGES.includes(code);
    }

    async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        const tts = await this.ensureModel();
        const voice = request.voiceId ?? this.voiceId;

        // kokoro-js generate() only supports { voice } — no speed/rate parameter
        // Rate adjustment is handled at playback level via HTMLAudioElement.playbackRate
        const audio = await tts.generate(request.text, { voice });

        // Extract audio data as WAV buffer
        // kokoro-js audio object has toWav() or save() methods
        // We need to get the raw buffer
        let wavBuffer: Buffer;

        if (typeof audio.toBlob === 'function') {
            const blob = await audio.toBlob();
            wavBuffer = Buffer.from(await blob.arrayBuffer());
        } else if (audio.data) {
            // Raw PCM data - wrap in WAV header
            wavBuffer = this.pcmToWav(audio.data, audio.sampling_rate ?? 24000);
        } else {
            // Fallback: save to temp file and read
            const tmpPath = join(getTtsModelsDir(), `tmp-${Date.now()}.wav`);
            await audio.save(tmpPath);
            wavBuffer = await readFile(tmpPath);
            await unlink(tmpPath);
        }

        return {
            audioBase64: wavBuffer.toString('base64'),
            mimeType: 'audio/wav',
        };
    }

    async downloadModel(onProgress: (pct: number) => void): Promise<void> {
        onProgress(0);

        try {
            const { KokoroTTS } = await import('kokoro-js');
            onProgress(10);
            kokoroInstance = await KokoroTTS.from_pretrained(MODEL_ID, {
                dtype: 'q8',
                device: 'cpu',
            });
            modelReady = true;
            this.cachedVoices = kokoroInstance.list_voices?.() ?? [];
            onProgress(100);
        } catch (err) {
            modelReady = false;
            throw err;
        }
    }

    async isModelReady(): Promise<boolean> {
        if (modelReady && kokoroInstance) return true;
        const cacheDir = join(getTtsModelsDir(), 'kokoro');
        try {
            await access(cacheDir);
            await access(join(cacheDir, 'onnx'));
            return true;
        } catch {
            return false;
        }
    }

    setConfig(settings: TtsProviderSettings): void {
        if (settings.voiceId) this.voiceId = settings.voiceId;
    }

    dispose(): void {
        kokoroInstance = null;
        modelReady = false;
        log.info('Kokoro TTS provider disposed');
    }

    private async ensureModel() {
        if (kokoroInstance) return kokoroInstance;

        const { KokoroTTS } = await import('kokoro-js');
        kokoroInstance = await KokoroTTS.from_pretrained(MODEL_ID, {
            dtype: 'q8',
            device: 'cpu',
        });
        modelReady = true;
        this.cachedVoices = kokoroInstance.list_voices?.() ?? [];
        return kokoroInstance;
    }

    private getVoiceList(): TtsVoice[] {
        const voiceIds =
            this.cachedVoices.length > 0
                ? this.cachedVoices
                : [
                      // American English
                      'af_heart',
                      'af_alloy',
                      'af_aoede',
                      'af_bella',
                      'af_jessica',
                      'af_kore',
                      'af_nicole',
                      'af_nova',
                      'af_river',
                      'af_sarah',
                      'af_sky',
                      'am_adam',
                      'am_echo',
                      'am_eric',
                      'am_fenrir',
                      'am_liam',
                      'am_michael',
                      'am_onyx',
                      'am_puck',
                      'am_santa',
                      // British English
                      'bf_alice',
                      'bf_emma',
                      'bf_isabella',
                      'bf_lily',
                      'bm_daniel',
                      'bm_fable',
                      'bm_george',
                      'bm_lewis',
                      // French
                      'ff_siwis',
                      // Spanish
                      'ef_dora',
                      'em_alex',
                      'em_santa',
                      // Hindi
                      'hf_alpha',
                      'hf_beta',
                      'hm_omega',
                      'hm_psi',
                      // Italian
                      'if_sara',
                      'im_nicola',
                      // Japanese
                      'jf_alpha',
                      'jf_gongitsune',
                      'jf_nezumi',
                      'jf_tebukuro',
                      'jm_kumo',
                      // Brazilian Portuguese
                      'pf_dora',
                      'pm_alex',
                      'pm_santa',
                      // Mandarin Chinese
                      'zf_xiaobei',
                      'zf_xiaoni',
                      'zf_xiaoxiao',
                      'zf_xiaoyi',
                      'zm_yunjian',
                      'zm_yunxi',
                      'zm_yunxia',
                      'zm_yunyang',
                  ];

        return voiceIds.map((id) => ({
            id,
            name: id.replace(/_/g, ' '),
            languageCodes: getVoiceLanguage(id),
            gender: getVoiceGender(id),
        }));
    }

    private pcmToWav(pcmData: Float32Array, sampleRate: number): Buffer {
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
        const blockAlign = (numChannels * bitsPerSample) / 8;
        const dataSize = pcmData.length * 2; // 16-bit = 2 bytes per sample
        const headerSize = 44;
        const buffer = Buffer.alloc(headerSize + dataSize);

        // RIFF header
        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(36 + dataSize, 4);
        buffer.write('WAVE', 8);

        // fmt chunk
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16); // chunk size
        buffer.writeUInt16LE(1, 20); // PCM format
        buffer.writeUInt16LE(numChannels, 22);
        buffer.writeUInt32LE(sampleRate, 24);
        buffer.writeUInt32LE(byteRate, 28);
        buffer.writeUInt16LE(blockAlign, 32);
        buffer.writeUInt16LE(bitsPerSample, 34);

        // data chunk
        buffer.write('data', 36);
        buffer.writeUInt32LE(dataSize, 40);

        // Convert float32 to int16
        for (let i = 0; i < pcmData.length; i++) {
            const sample = Math.max(-1, Math.min(1, pcmData[i]));
            buffer.writeInt16LE(sample < 0 ? sample * 0x8000 : sample * 0x7fff, headerSize + i * 2);
        }

        return buffer;
    }
}
