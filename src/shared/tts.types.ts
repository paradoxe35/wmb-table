// ── Provider identification ──
export const TTS_PROVIDER_TYPES = ['browser', 'sherpa', 'kokoro', 'elevenlabs', 'openai'] as const;
export type TtsProviderType = (typeof TTS_PROVIDER_TYPES)[number];
export type TtsProviderLocality = 'local' | 'remote';

// ── Voice definition ──
export interface TtsVoice {
    id: string;
    name: string;
    languageCodes: string[]; // BCP-47 codes: 'en', 'fr', 'zh', etc.
    gender?: 'male' | 'female' | 'neutral';
    isCloned?: boolean; // true for cloned voices (e.g. ElevenLabs IVC)
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
    apiEndpoint?: string; // custom API endpoint override
    model?: string;
    voiceId?: string;
    pitch?: number; // 0.5–2.0 (browser only)
    volume?: number; // 0–1 (browser only)
}

// ── Global TTS settings ──
export type TtsHighlightMode = 'sentence' | 'paragraph';

export interface TtsSettings {
    activeProvider: TtsProviderType;
    fallbackOrder: TtsProviderType[];
    highlightMode: TtsHighlightMode; // default: 'sentence'
    segmentGapMs: number; // pause between segments in ms, default: 700
    autoPlay: boolean;
    autoSwitchVoice: boolean;
    rate: number; // 0.5–2.0, default: 1
    cacheMaxSizeMb: number; // default: 1000
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

// ── Voice cloning (ElevenLabs) ──
export interface TtsVoiceCloneRequest {
    name: string; // up to 16 chars, [a-zA-Z0-9_]
    audioBase64: string; // base64-encoded audio (WAV/MP3/M4A, 10-60s, ≥24kHz mono)
}

export interface TtsVoiceCloneResult {
    voiceId: string; // returned voice ID for use in synthesis
}

// ── Per-language model info (for providers with multiple downloadable models) ──
export interface TtsModelInfo {
    langCode: string;
    langLabel: string;
    langName?: string;
    modelName: string;
    voiceName: string;
    installed: boolean;
    engine?: string;
    quality?: string;
    filesizeMb?: number;
    numSpeakers?: number;
}

// ── Language compatibility ──
export type TtsIncompatibilityReason =
    | 'not_configured' // API key missing (ElevenLabs, OpenAI)
    | 'model_not_downloaded' // local model not installed (Kokoro, Sherpa)
    | 'no_voice_for_language' // selected voice/model doesn't match the document language
    | 'unsupported_language'; // provider doesn't support this language at all

export interface TtsCompatibilityResult {
    supported: boolean;
    reason?: TtsIncompatibilityReason;
}

// ── French language labels (shared across main + renderer) ──
export const LANG_LABELS_FR: Record<string, string> = {
    en: 'Anglais',
    fr: 'Français',
    de: 'Allemand',
    es: 'Espagnol',
    it: 'Italien',
    pt: 'Portugais',
    ru: 'Russe',
    zh: 'Chinois',
    nl: 'Néerlandais',
    pl: 'Polonais',
    uk: 'Ukrainien',
    sv: 'Suédois',
    da: 'Danois',
    no: 'Norvégien',
    fi: 'Finnois',
    tr: 'Turc',
    cs: 'Tchèque',
    ro: 'Roumain',
    hu: 'Hongrois',
    el: 'Grec',
    ar: 'Arabe',
    hi: 'Hindi',
    vi: 'Vietnamien',
    id: 'Indonésien',
    ka: 'Géorgien',
    sk: 'Slovaque',
    sr: 'Serbe',
    ca: 'Catalan',
    sw: 'Swahili',
    is: 'Islandais',
    bg: 'Bulgare',
    bn: 'Bengali',
    fa: 'Persan',
    ja: 'Japonais',
    ko: 'Coréen',
    th: 'Thaï',
    he: 'Hébreu',
    ms: 'Malais',
    ta: 'Tamoul',
    te: 'Télougou',
    ml: 'Malayalam',
    mr: 'Marathi',
    ne: 'Népalais',
    si: 'Cingalais',
    lb: 'Luxembourgeois',
    mk: 'Macédonien',
    lt: 'Lituanien',
    lv: 'Letton',
    et: 'Estonien',
    gl: 'Galicien',
    eu: 'Basque',
    gu: 'Gujarati',
    kn: 'Kannada',
    ha: 'Haoussa',
    am: 'Amharique',
    cy: 'Gallois',
    be: 'Biélorusse',
    sl: 'Slovène',
    hr: 'Croate',
    sq: 'Albanais',
    yue: 'Cantonais',
};

// ── Default settings factory ──
export function createDefaultTtsSettings(): TtsSettings {
    return {
        activeProvider: 'browser',
        fallbackOrder: [...TTS_PROVIDER_TYPES],
        highlightMode: 'sentence',
        segmentGapMs: 700,
        autoPlay: false,
        autoSwitchVoice: true,
        rate: 1,
        cacheMaxSizeMb: 1000,
        providers: {
            browser: { provider: 'browser', enabled: true },
            sherpa: { provider: 'sherpa', enabled: false },
            kokoro: { provider: 'kokoro', enabled: false },
            elevenlabs: {
                provider: 'elevenlabs',
                enabled: false,
            },
            openai: { provider: 'openai', enabled: false },
        },
    };
}
