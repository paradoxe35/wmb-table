// ── Provider identification ──
export const SEGMENT_GAP_MS = 500;
export type TtsProviderLocality = 'local' | 'remote';

export interface TtsProviderMeta {
    label: string;
    locality: TtsProviderLocality;
    hint: string;
    free: boolean;
}

export const PROVIDER_CATALOG = {
    browser: {
        label: 'Voix du système',
        locality: 'local',
        hint: 'Gratuit, fonctionne sans connexion internet. Utilise les voix déjà installées sur votre ordinateur.',
        free: true,
    },
    sherpa: {
        label: 'Sherpa-ONNX TTS',
        locality: 'local',
        hint: 'Gratuit, fonctionne sans connexion internet. Supporte de nombreuses langues et voix. Nécessite un premier téléchargement.',
        free: true,
    },
    elevenlabs: {
        label: 'ElevenLabs TTS',
        locality: 'remote',
        hint: 'Excellente qualité. Permet de cloner votre voix. Nécessite un compte et une connexion internet.',
        free: false,
    },
    openai: {
        label: 'OpenAI TTS',
        locality: 'remote',
        hint: 'Excellente qualité, nombreuses langues disponibles. Nécessite un compte et une connexion internet.',
        free: false,
    },
    edge: {
        label: 'Edge TTS (Microsoft)',
        locality: 'remote',
        hint: 'Gratuit, bonne qualité, nombreuses langues. Nécessite une connexion internet. Aucun compte requis.',
        free: true,
    },
} as const satisfies Record<string, TtsProviderMeta>;

export type TtsProviderType = keyof typeof PROVIDER_CATALOG;
export const TTS_PROVIDER_TYPES = Object.keys(PROVIDER_CATALOG) as TtsProviderType[];
export const DEFAULT_TTS_PROVIDER: TtsProviderType = 'sherpa';

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
    apiKey?: string;
    apiEndpoint?: string;
    model?: string;
    voiceId?: string;
    pitch?: number; // 0.5–2.0 (browser only)
    volume?: number; // 0–1 (browser only)
}

// ── Global TTS settings ──
export type TtsHighlightMode = 'sentence' | 'paragraph';

export interface TtsSettings {
    activeProvider: TtsProviderType;
    highlightMode: TtsHighlightMode; // default: 'sentence'
    segmentGapMs: number; // pause between segments in ms
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
    modelName?: string;
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

// ── Voice cloning ──
export interface TtsVoiceCloneRequest {
    name: string; // up to 16 chars, [a-zA-Z0-9_]
    audioBase64: string; // base64-encoded audio (WAV/MP3/M4A, 10-60s, ≥24kHz mono)
}

export interface TtsVoiceCloneResult {
    voiceId: string; // returned voice ID for use in synthesis
}

// ── Built-in reference voices for cloning ──
export interface TtsReferenceVoice {
    id: string; // unique key, e.g. 'francois_lepicard'
    name: string; // display name
    fileName: string; // file in resources/tts/
}

export const TTS_REFERENCE_VOICES: TtsReferenceVoice[] = [
    {
        id: 'francois_lepicard',
        name: 'François Lepicard',
        fileName: 'francois-lepicard-voice.mp3',
    },
];

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
    | 'model_not_downloaded' // local model not installed
    | 'no_model_for_language' // selected model doesn't support the document language
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
    my: 'Birman',
    ur: 'Ourdou',
    pa: 'Pendjabi',
    af: 'Afrikaans',
    az: 'Azerbaïdjanais',
    bs: 'Bosnien',
    fil: 'Filipino',
    ga: 'Irlandais',
    jv: 'Javanais',
    km: 'Khmer',
    lo: 'Lao',
    mn: 'Mongol',
    mt: 'Maltais',
    nb: 'Norvégien bokmål',
    ps: 'Pachto',
    so: 'Somali',
    su: 'Soundanais',
    uz: 'Ouzbek',
    zu: 'Zoulou',
    wuu: 'Chinois wu',
    // Additional languages
    hy: 'Arménien',
    kk: 'Kazakh',
    ky: 'Kirghize',
    tg: 'Tadjik',
    tk: 'Turkmène',
    tt: 'Tatar',
    yo: 'Yoruba',
    ig: 'Igbo',
    xh: 'Xhosa',
    sn: 'Shona',
    rw: 'Kinyarwanda',
    mg: 'Malgache',
    eo: 'Espéranto',
    la: 'Latin',
    tl: 'Tagalog',
    ht: 'Créole haïtien',
    ku: 'Kurde',
    sd: 'Sindhi',
    or: 'Odia',
    as: 'Assamais',
    fy: 'Frison',
    gd: 'Gaélique écossais',
    mi: 'Maori',
    sm: 'Samoan',
    to: 'Tongien',
    haw: 'Hawaïen',
    ceb: 'Cebuano',
    ny: 'Chichewa',
    co: 'Corse',
    hmn: 'Hmong',
    st: 'Sotho',
    ts: 'Tsonga',
    tn: 'Tswana',
    ak: 'Akan',
    ln: 'Lingala',
    om: 'Oromo',
    ti: 'Tigrinya',
    wo: 'Wolof',
    ii: 'Yi',
};

// ── Text helpers ──

/** Returns true if the text contains at least one letter (any script). */
export function hasSpeakableContent(text: string): boolean {
    return /\p{L}/u.test(text);
}

// ── Default settings factory ──
export function createDefaultTtsSettings(): TtsSettings {
    return {
        activeProvider: DEFAULT_TTS_PROVIDER,
        highlightMode: 'sentence',
        segmentGapMs: SEGMENT_GAP_MS,
        autoPlay: false,
        autoSwitchVoice: true,
        rate: 1,
        cacheMaxSizeMb: 1000,
        providers: {
            browser: {},
            sherpa: {},
            elevenlabs: {},
            openai: {},
            edge: {},
        },
    };
}
