import { Worker } from 'node:worker_threads';
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
import workerPath from './kokoro.worker?modulePath';

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

// ---------------------------------------------------------------------------
// Worker RPC
// ---------------------------------------------------------------------------

let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let progressCallback: ((pct: number) => void) | null = null;

function getWorker(): Worker {
    if (!worker) {
        worker = new Worker(workerPath);
        worker.on('message', (msg: { id: number; result?: unknown; error?: string }) => {
            // Handle progress broadcasts (id === -1)
            if (msg.id === -1 && msg.result && typeof msg.result === 'object') {
                const r = msg.result as { type?: string; percentage?: number };
                if (r.type === 'progress' && progressCallback) {
                    progressCallback(r.percentage ?? 0);
                }
                return;
            }

            const p = pending.get(msg.id);
            if (!p) return;
            pending.delete(msg.id);
            if (msg.error) {
                p.reject(new Error(msg.error));
            } else {
                p.resolve(msg.result);
            }
        });
        worker.on('error', (err) => {
            log.error('[tts-worker] Worker error:', err);
        });
    }
    return worker;
}

function call<T>(method: string, ...args: unknown[]): Promise<T> {
    const id = ++requestId;
    return new Promise<T>((resolve, reject) => {
        pending.set(id, {
            resolve: resolve as (v: unknown) => void,
            reject,
        });
        getWorker().postMessage({ id, method, args });
    });
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

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
        const voice = request.voiceId ?? this.voiceId;
        const modelsDir = getTtsModelsDir();

        const audioBase64 = await call<string>('synthesize', request.text, voice, modelsDir);

        // Refresh cached voices after first synthesis
        if (this.cachedVoices.length === 0) {
            this.cachedVoices = await call<string[]>('listVoices');
        }

        return { audioBase64, mimeType: 'audio/wav' };
    }

    async downloadModel(onProgress: (pct: number) => void, _modelName?: string): Promise<void> {
        onProgress(0);
        progressCallback = onProgress;

        try {
            await call<void>('downloadModel');
            this.cachedVoices = await call<string[]>('listVoices');
        } catch (err) {
            throw err;
        } finally {
            progressCallback = null;
        }
    }

    async isModelReady(): Promise<boolean> {
        return call<boolean>('isModelReady');
    }

    setConfig(settings: TtsProviderSettings): void {
        if (settings.voiceId) this.voiceId = settings.voiceId;
    }

    dispose(): void {
        call('dispose').catch(() => {});
        if (worker) {
            worker.terminate().catch(() => {});
            worker = null;
            pending.clear();
        }
        log.info('Kokoro TTS provider disposed');
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
}
