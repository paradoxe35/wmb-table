import { mkdirSync } from 'node:fs';
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
    TtsCompatibilityResult,
} from '@shared/tts.types';
import { getTtsModelsDir } from '@main/lib/app-paths';
import { WorkerRpc } from './worker-rpc';
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
    return VOICE_LANG_MAP[voiceId.substring(0, 2)] ?? ['en'];
}

function getVoiceGender(voiceId: string): 'male' | 'female' {
    return voiceId[1] === 'm' ? 'male' : 'female';
}

function getKokoroModelsDir(): string {
    const dir = join(getTtsModelsDir(), 'kokoro');
    mkdirSync(dir, { recursive: true });
    return dir;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class KokoroProvider implements TtsProvider {
    readonly type: TtsProviderType = 'kokoro';
    private voiceId = 'af_heart';
    private cachedVoices: string[] = [];
    private readonly rpc = new WorkerRpc(workerPath, 'kokoro');
    private workerInitialized = false;

    private async ensureWorkerInitialized(): Promise<void> {
        if (this.workerInitialized) return;
        await this.rpc.call<void>('initialize', getKokoroModelsDir());
        this.workerInitialized = true;
    }

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

    async checkCompatibility(
        langCode: string,
        _cfg?: TtsProviderSettings,
    ): Promise<TtsCompatibilityResult> {
        const code = langCode.split('-')[0].toLowerCase();
        if (!SUPPORTED_LANGUAGES.includes(code)) {
            return { supported: false, reason: 'unsupported_language' };
        }
        if (!(await this.isModelReady())) {
            return { supported: false, reason: 'model_not_downloaded' };
        }
        // Any Kokoro voice can speak any supported language
        return { supported: true };
    }

    async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        await this.ensureWorkerInitialized();
        const voice = request.voiceId ?? this.voiceId;
        const audioBase64 = await this.rpc.call<string>('synthesize', request.text, voice);

        // Refresh voice list after first synthesis if not yet populated
        if (this.cachedVoices.length === 0) {
            this.cachedVoices = await this.rpc.call<string[]>('listVoices');
        }

        return { audioBase64, mimeType: 'audio/wav' };
    }

    async downloadModel(onProgress: (pct: number) => void): Promise<void> {
        await this.ensureWorkerInitialized();
        onProgress(0);
        this.rpc.onProgress = onProgress;
        try {
            await this.rpc.call<void>('downloadModel');
            this.cachedVoices = await this.rpc.call<string[]>('listVoices');
        } finally {
            this.rpc.onProgress = null;
        }
    }

    async isModelReady(): Promise<boolean> {
        await this.ensureWorkerInitialized();
        return this.rpc.call<boolean>('isModelReady');
    }

    setConfig(settings: TtsProviderSettings): void {
        if (settings.voiceId) this.voiceId = settings.voiceId;
    }

    resolveConfigForLanguage(
        langCode: string,
        cfg?: TtsProviderSettings,
    ): Partial<TtsProviderSettings> | null {
        const code = langCode.split('-')[0].toLowerCase();
        if (!SUPPORTED_LANGUAGES.includes(code)) {
            return null;
        }

        const currentVoice = cfg?.voiceId ?? this.voiceId;
        if (getVoiceLanguage(currentVoice).includes(code)) {
            return null;
        }

        // Try to find a voice whose default language matches, otherwise keep current voice
        // (any Kokoro voice can speak any supported language)
        const compatibleVoice = this.getVoiceList().find((voice) =>
            voice.languageCodes.includes(code),
        );
        return compatibleVoice ? { voiceId: compatibleVoice.id } : null;
    }

    async previewVoice(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        return this.synthesize(request);
    }

    dispose(): void {
        this.rpc.call('dispose').catch(() => {});
        this.rpc.dispose();
        this.workerInitialized = false;
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
