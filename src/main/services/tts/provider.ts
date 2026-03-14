import type {
    TtsProviderType,
    TtsProviderInfo,
    TtsProviderSettings,
    TtsSynthesizeRequest,
    TtsSynthesizeResult,
    TtsModelInfo,
    TtsCompatibilityResult,
    TtsVoiceCloneRequest,
    TtsVoiceCloneResult,
    TtsVoice,
} from '@shared/tts.types';

export interface TtsProvider {
    readonly type: TtsProviderType;
    getInfo(): Promise<TtsProviderInfo>;
    checkCompatibility(
        langCode: string,
        cfg?: TtsProviderSettings,
    ): Promise<TtsCompatibilityResult>;
    synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult>;
    previewVoice(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult>;
    downloadModel?(onProgress: (pct: number) => void, modelName?: string): Promise<void>;
    isModelReady?(): Promise<boolean>;
    getAvailableModels?(): TtsModelInfo[];
    deleteModel?(modelName: string): Promise<void>;
    /** Return config fields to update for language compatibility, or null if already correct / not applicable. */
    resolveConfigForLanguage?(
        langCode: string,
        cfg?: TtsProviderSettings,
    ): Partial<TtsProviderSettings> | null;
    // Voice cloning (optional — providers set supportsVoiceCloning: true)
    cloneVoice?(request: TtsVoiceCloneRequest): Promise<TtsVoiceCloneResult>;
    listClonedVoices?(): Promise<TtsVoice[]>;
    deleteClonedVoice?(voiceId: string): Promise<void>;
    setConfig(settings: TtsProviderSettings): void;
    dispose(): void;
}
