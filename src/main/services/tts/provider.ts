import type {
    TtsProviderType,
    TtsProviderInfo,
    TtsProviderSettings,
    TtsSynthesizeRequest,
    TtsSynthesizeResult,
} from '@shared/tts.types';

export interface TtsProvider {
    readonly type: TtsProviderType;
    getInfo(): Promise<TtsProviderInfo>;
    supportsLanguage(langCode: string): boolean;
    synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult>;
    synthesizeStream?(request: TtsSynthesizeRequest): AsyncGenerator<Buffer>;
    downloadModel?(onProgress: (pct: number) => void): Promise<void>;
    isModelReady?(): Promise<boolean>;
    setConfig(settings: TtsProviderSettings): void;
    dispose(): void;
}
