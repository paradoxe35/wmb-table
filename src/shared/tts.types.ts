// ── Provider identification ──
export type TtsProviderType = 'browser' | 'kokoro' | 'qwen' | 'openai';
export type TtsProviderLocality = 'local' | 'remote';

// ── Voice definition ──
export interface TtsVoice {
    id: string;
    name: string;
    languageCodes: string[]; // BCP-47 codes: 'en', 'fr', 'zh', etc.
    gender?: 'male' | 'female' | 'neutral';
    isCloned?: boolean; // true for Qwen cloned voices
}

// ── Provider capabilities (serializable across IPC) ──
export interface TtsProviderInfo {
    type: TtsProviderType;
    locality: TtsProviderLocality;
    displayName: string;
    supportedLanguages: string[];
    supportsVoiceCloning: boolean;
    supportsStreaming: boolean;
    voices: TtsVoice[];
    defaultModel: string | null;
    availableModels: string[];
    requiresApiKey: boolean;
    requiresModelDownload: boolean;
    modelDownloaded?: boolean;
}

// ── Per-provider settings (persisted) ──
export interface TtsProviderSettings {
    provider: TtsProviderType;
    enabled: boolean;
    apiKey?: string; // encrypted at rest via safeStorage
    apiEndpoint?: string; // for Qwen DashScope URL
    model?: string;
    voiceId?: string;
    pitch?: number; // 0.5–2.0 (browser only)
    volume?: number; // 0–1 (browser only)
}

// ── Global TTS settings ──
export interface TtsSettings {
    activeProvider: TtsProviderType;
    fallbackOrder: TtsProviderType[];
    highlightMode: 'word' | 'sentence' | 'paragraph'; // default: 'sentence'
    autoPlay: boolean;
    rate: number; // 0.5–2.0, default: 1
    cacheMaxSizeMb: number; // default: 500
    providers: Record<TtsProviderType, TtsProviderSettings>;
}

// ── Text segment for TTS pipeline ──
export interface TtsSegment {
    index: number;
    text: string;
    paragraphIndex: number;
    startOffset: number; // char offset within paragraph
    endOffset: number;
}

// ── Playback state (pushed from main → renderer) ──
export type TtsPlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface TtsPlaybackState {
    status: TtsPlaybackStatus;
    currentSegmentIndex: number;
    totalSegments: number;
    provider: TtsProviderType;
    error?: string;
}

// ── Cache key ──
export interface TtsCacheKey {
    provider: TtsProviderType;
    model: string;
    voiceId: string;
    language: string;
    rate: number;
    textHash: string; // SHA-256 truncated to 16 hex chars
}

// ── Model download progress ──
export interface TtsModelDownloadProgress {
    provider: TtsProviderType;
    percentage: number;
    status: 'downloading' | 'complete' | 'error';
    error?: string;
}

// ── Synthesis request/result ──
export interface TtsSynthesizeRequest {
    text: string;
    language: string;
    provider?: TtsProviderType;
    voiceId?: string;
    model?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
}

export interface TtsSynthesizeResult {
    audioBase64: string; // base64-encoded audio bytes
    mimeType: string; // 'audio/wav', 'audio/mp3', etc.
    duration?: number; // seconds, if known
}

// ── Segment audio pushed to renderer ──
export interface TtsSegmentAudio {
    segmentIndex: number;
    audioBase64: string;
    mimeType: string;
    duration?: number;
}

// ── Voice cloning (Qwen) ──
export interface TtsVoiceCloneRequest {
    name: string; // up to 16 chars, [a-zA-Z0-9_]
    audioBase64: string; // base64-encoded audio (WAV/MP3/M4A, 10-60s, ≥24kHz mono)
    targetModel: string; // e.g. 'qwen3-tts-vc-2026-01-22'
}

export interface TtsVoiceCloneResult {
    voiceId: string; // returned voice ID for use in synthesis
    targetModel: string;
}

// ── Default settings factory ──
export function createDefaultTtsSettings(): TtsSettings {
    return {
        activeProvider: 'browser',
        fallbackOrder: ['browser', 'kokoro', 'qwen', 'openai'],
        highlightMode: 'sentence',
        autoPlay: false,
        rate: 1,
        cacheMaxSizeMb: 500,
        providers: {
            browser: { provider: 'browser', enabled: true },
            kokoro: { provider: 'kokoro', enabled: false },
            qwen: {
                provider: 'qwen',
                enabled: false,
                apiEndpoint:
                    'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
            },
            openai: { provider: 'openai', enabled: false },
        },
    };
}
