import type {
    TtsProviderType,
    TtsProviderInfo,
    TtsProviderSettings,
    TtsSynthesizeRequest,
    TtsSynthesizeResult,
    TtsModelInfo,
} from '@shared/tts.types';

export interface TtsProvider {
    readonly type: TtsProviderType;
    getInfo(): Promise<TtsProviderInfo>;
    supportsLanguage(langCode: string): boolean;
    synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult>;
    previewVoice(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult>;
    synthesizeStream?(request: TtsSynthesizeRequest): AsyncGenerator<Buffer>;
    downloadModel?(onProgress: (pct: number) => void, modelName?: string): Promise<void>;
    isModelReady?(): Promise<boolean>;
    getAvailableModels?(): TtsModelInfo[];
    deleteModel?(modelName: string): Promise<void>;
    setConfig(settings: TtsProviderSettings): void;
    dispose(): void;
}
