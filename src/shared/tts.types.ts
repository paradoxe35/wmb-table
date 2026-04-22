// ── Provider identification ──
export const SEGMENT_GAP_MS = 300;
export type TtsProviderLocality = 'local' | 'remote';

export interface TtsProviderMeta {
    label: string;
    locality: TtsProviderLocality;
    hint: string;
    free: boolean;
    apiKeyUrl?: string;
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
    edge: {
        label: 'Edge TTS (Microsoft)',
        locality: 'remote',
        hint: 'Gratuit, bonne qualité, nombreuses langues. Nécessite une connexion internet. Aucun compte requis.',
        free: true,
    },
    cartesia: {
        label: 'Cartesia TTS',
        locality: 'remote',
        hint: 'Excellente qualité. Permet de cloner votre voix. Nécessite un compte et une connexion internet.',
        free: false,
        apiKeyUrl: 'https://play.cartesia.ai/keys',
    },
    elevenlabs: {
        label: 'ElevenLabs TTS',
        locality: 'remote',
        hint: 'Excellente qualité. Permet de cloner votre voix. Nécessite un compte et une connexion internet.',
        free: false,
        apiKeyUrl: 'https://elevenlabs.io/app/developers/api-keys',
    },
    openai: {
        label: 'OpenAI TTS',
        locality: 'remote',
        hint: 'Excellente qualité, nombreuses langues disponibles. Nécessite un compte et une connexion internet.',
        free: false,
        apiKeyUrl: 'https://platform.openai.com/api-keys',
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
    autoSwitchVoice: boolean;
    rate: number; // 0.5–2.0, default: 1
    cacheMaxSizeMb: number; // default: 1000
    providers: Record<TtsProviderType, TtsProviderSettings>;
    readIntroduction: boolean; // default: true
    announceSegmentNumbers: boolean; // default: false
    bibleReadEntireBook: boolean; // default: false
    autoScrollToHighlight: boolean; // default: true
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
    completedNaturally?: boolean; // true when all segments finished (not user stop)
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
    phase?: 'downloading' | 'extracting' | 'finalizing';
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
    audioBase64?: string;
    audioUrl?: string;
    mimeType: string;
    duration?: number;
    /** When true, the renderer should pre-decode this audio but not play it yet. */
    queued?: boolean;
}

// ── Voice cloning ──
export interface TtsVoiceCloneRequest {
    name: string; // up to 16 chars, [a-zA-Z0-9_]
    audioBase64: string; // base64-encoded audio (WAV/MP3/M4A, 10-60s, ≥24kHz mono)
    language?: string; // BCP-47 code, required by some providers (e.g. Cartesia)
}

export interface TtsVoiceCloneResult {
    voiceId: string; // returned voice ID for use in synthesis
}

export interface TtsReferenceVoiceAudio {
    audioBase64: string; // base64-encoded audio bytes
    mimeType: string; // 'audio/wav', 'audio/mpeg', 'audio/mp4', etc.
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
    langCode: string | string[];
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

const ISO3_TO_ISO1: Record<string, string> = {
    fra: 'fr',
    eng: 'en',
    deu: 'de',
    spa: 'es',
    ita: 'it',
    por: 'pt',
    rus: 'ru',
    zho: 'zh',
    nld: 'nl',
    pol: 'pl',
    ukr: 'uk',
    swe: 'sv',
    dan: 'da',
    nor: 'no',
    fin: 'fi',
    tur: 'tr',
    ces: 'cs',
    ron: 'ro',
    hun: 'hu',
    ell: 'el',
    isl: 'is',
    bul: 'bg',
    ltz: 'lb',
    mkd: 'mk',
    lit: 'lt',
    lav: 'lv',
    est: 'et',
    glg: 'gl',
    eus: 'eu',
    cat: 'ca',
    cym: 'cy',
    bel: 'be',
    slv: 'sl',
    hrv: 'hr',
    srp: 'sr',
    sqi: 'sq',
    slk: 'sk',
    fao: 'fo',
    lat: 'la',
    ara: 'ar',
    hin: 'hi',
    vie: 'vi',
    ind: 'id',
    fas: 'fa',
    jpn: 'ja',
    kor: 'ko',
    tha: 'th',
    heb: 'he',
    msa: 'ms',
    zlm: 'ms',
    tam: 'ta',
    tel: 'te',
    mal: 'ml',
    mar: 'mr',
    nep: 'ne',
    sin: 'si',
    guj: 'gu',
    kan: 'kn',
    pan: 'pa',
    ben: 'bn',
    ory: 'or',
    asm: 'as',
    kat: 'ka',
    tgl: 'tl',
    jav: 'jv',
    sun: 'su',
    khm: 'km',
    lao: 'lo',
    mya: 'my',
    bod: 'bo',
    dzo: 'dz',
    div: 'dv',
    kaz: 'kk',
    kir: 'ky',
    tgk: 'tg',
    tat: 'tt',
    aze: 'az',
    uzb: 'uz',
    tuk: 'tk',
    mon: 'mn',
    swa: 'sw',
    swh: 'sw',
    hau: 'ha',
    amh: 'am',
    yor: 'yo',
    ibo: 'ig',
    orm: 'om',
    som: 'so',
    sna: 'sn',
    nya: 'ny',
    kin: 'rw',
    run: 'rn',
    lin: 'ln',
    sag: 'sg',
    tso: 'ts',
    bam: 'bm',
    ful: 'ff',
    ewe: 'ee',
    wol: 'wo',
    aka: 'ak',
    mlg: 'mg',
    hat: 'ht',
    grn: 'gn',
    que: 'qu',
    smo: 'sm',
    fij: 'fj',
    ava: 'av',
    bak: 'ba',
    che: 'ce',
    chv: 'cv',
    oss: 'os',
};

export function iso3ToIso1LanguageCode(code: string): string {
    return ISO3_TO_ISO1[code.toLowerCase()] ?? code.toLowerCase();
}

export function normalizeLanguageCode(code: string): string {
    return iso3ToIso1LanguageCode(code.split('-')[0]);
}

function resolveLanguageLabel(
    labels: Record<string, string>,
    languageCode: string,
): string | undefined {
    const normalizedCode = normalizeLanguageCode(languageCode);
    return labels[languageCode] ?? labels[normalizedCode];
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

// ── Native language labels (each language name in its own script) ──
export const LANG_LABELS_NATIVE: Record<string, string> = {
    en: 'English',
    fr: 'Français',
    de: 'Deutsch',
    es: 'Español',
    it: 'Italiano',
    pt: 'Português',
    ru: 'Русский',
    zh: '中文',
    nl: 'Nederlands',
    pl: 'Polski',
    uk: 'Українська',
    sv: 'Svenska',
    da: 'Dansk',
    no: 'Norsk',
    fi: 'Suomi',
    tr: 'Türkçe',
    cs: 'Čeština',
    ro: 'Română',
    hu: 'Magyar',
    el: 'Ελληνικά',
    ar: 'العربية',
    hi: 'हिन्दी',
    vi: 'Tiếng Việt',
    id: 'Bahasa Indonesia',
    ka: 'ქართული',
    sk: 'Slovenčina',
    sr: 'Српски',
    ca: 'Català',
    sw: 'Kiswahili',
    is: 'Íslenska',
    bg: 'Български',
    bn: 'বাংলা',
    fa: 'فارسی',
    ja: '日本語',
    ko: '한국어',
    th: 'ไทย',
    he: 'עברית',
    ms: 'Bahasa Melayu',
    ta: 'தமிழ்',
    te: 'తెలుగు',
    ml: 'മലയാളം',
    mr: 'मराठी',
    ne: 'नेपाली',
    si: 'සිංහල',
    lb: 'Lëtzebuergesch',
    mk: 'Македонски',
    lt: 'Lietuvių',
    lv: 'Latviešu',
    et: 'Eesti',
    gl: 'Galego',
    eu: 'Euskara',
    gu: 'ગુજરાતી',
    kn: 'ಕನ್ನಡ',
    ha: 'Hausa',
    am: 'አማርኛ',
    cy: 'Cymraeg',
    be: 'Беларуская',
    sl: 'Slovenščina',
    hr: 'Hrvatski',
    sq: 'Shqip',
    yue: '粵語',
    my: 'မြန်မာ',
    ur: 'اردو',
    pa: 'ਪੰਜਾਬੀ',
    af: 'Afrikaans',
    az: 'Azərbaycan',
    bs: 'Bosanski',
    fil: 'Filipino',
    ga: 'Gaeilge',
    jv: 'Basa Jawa',
    km: 'ខ្មែរ',
    lo: 'ລາວ',
    mn: 'Монгол',
    mt: 'Malti',
    nb: 'Norsk bokmål',
    ps: 'پښتو',
    so: 'Soomaali',
    su: 'Basa Sunda',
    uz: 'Oʻzbek',
    zu: 'isiZulu',
    tl: 'Tagalog',
    hy: 'Հայերեն',
    kk: 'Қазақ',
    ky: 'Кыргызча',
    tg: 'Тоҷикӣ',
    tk: 'Türkmen',
    tt: 'Татар',
    yo: 'Yorùbá',
    ig: 'Igbo',
    xh: 'isiXhosa',
    sn: 'chiShona',
    rw: 'Kinyarwanda',
    mg: 'Malagasy',
    eo: 'Esperanto',
    la: 'Latina',
    ln: 'Lingála',
    or: 'ଓଡ଼ିଆ',
    as: 'অসমীয়া',
    fy: 'Frysk',
    gd: 'Gàidhlig',
    sd: 'سنڌي',
};

export function getLanguageLabelFr(languageCode: string): string {
    return resolveLanguageLabel(LANG_LABELS_FR, languageCode) ?? languageCode;
}

export function getLanguageLabelNative(languageCode: string): string {
    return resolveLanguageLabel(LANG_LABELS_NATIVE, languageCode) ?? languageCode;
}

export function getLanguageDisplayName(languageCode: string): string {
    return (
        resolveLanguageLabel(LANG_LABELS_NATIVE, languageCode) ??
        resolveLanguageLabel(LANG_LABELS_FR, languageCode) ??
        languageCode
    );
}

// ── Text helpers ──

/** Returns true if the text contains at least one letter (any script). */
export function hasSpeakableContent(text: string): boolean {
    return /\p{L}/u.test(text);
}

// ── Default settings factory ──
export const DEFAULT_CACHE_MAX_SIZE_MB = 1000;
export function createDefaultTtsSettings(): TtsSettings {
    return {
        activeProvider: DEFAULT_TTS_PROVIDER,
        highlightMode: 'sentence',
        segmentGapMs: SEGMENT_GAP_MS,
        autoSwitchVoice: true,
        rate: 1,
        cacheMaxSizeMb: DEFAULT_CACHE_MAX_SIZE_MB,
        providers: {
            browser: {},
            sherpa: {},
            elevenlabs: {},
            openai: {},
            edge: {},
            cartesia: {},
        },
        readIntroduction: true,
        announceSegmentNumbers: false,
        bibleReadEntireBook: false,
        autoScrollToHighlight: true,
    };
}

// ── Segment announcement helper ──

const VERSE_LABELS: Record<string, string> = {
    // Standard ISO 639-1
    af: 'Vers',
    ar: 'آية',
    bg: 'Стих',
    cs: 'Verš',
    da: 'Vers',
    de: 'Vers',
    en: 'Verse',
    es: 'Versículo',
    fa: 'آیه',
    fi: 'Jae',
    fr: 'Verset',
    ha: 'Aya',
    he: 'פסוק',
    hi: 'वचन',
    hr: 'Redak',
    hu: 'Vers',
    id: 'Ayat',
    it: 'Versetto',
    ja: '節',
    ko: '절',
    ln: 'Vɛrsɛ',
    lv: 'Pants',
    mg: 'Andininy',
    ml: 'വാക്യം',
    mr: 'वचन',
    ne: 'पद',
    nl: 'Vers',
    nn: 'Vers',
    no: 'Vers',
    or: 'ଗ୍ରନ୍ଥ',
    pa: 'ਆਇਤ',
    pl: 'Werset',
    pt: 'Versículo',
    ro: 'Verset',
    ru: 'Стих',
    rw: 'Umurongo',
    sk: 'Verš',
    sr: 'Stih',
    st: 'Temana',
    sv: 'Vers',
    sw: 'Mstari',
    ta: 'வசனம்',
    te: 'వచనము',
    tl: 'Talata',
    tr: 'Ayet',
    uk: 'Вірш',
    ur: 'آیت',
    vi: 'Câu',
    zh: '节',
    zu: 'Ivesi',
    // App-specific codes (non-standard ISO)
    amh: 'ቁጥር',
    bem: 'Vesi',
    ben: 'পদ',
    ceb: 'Bersikulo',
    cre: 'Vèsè',
    emk: 'Vesi',
    ewe: 'Vɔ',
    fin: 'Jae',
    fon: 'Vèsè',
    kde: 'Vesi',
    khm: 'ខ្នាត',
    kng: 'Vesi',
    kya: 'Vesi',
    lit: 'Eilutė',
    loz: 'Vesi',
    lua: 'Vesikulɔ',
    lug: 'Vesi',
    lve: 'Vesi',
    mya: 'ကျမ်းပိုဒ်',
    nde: 'Ivesi',
    nso: 'Temana',
    nya: 'Vesi',
    orm: 'Aaya',
    osh: 'Vesi',
    run: 'Umunyororo',
    sna: 'Vhesi',
    ssw: 'Ivesi',
    teo: 'Vesi',
    tng: 'Vesi',
    tsn: 'Temana',
    tso: 'Vhesi',
    tum: 'Vesi',
    tur: 'Ayet',
    twi: 'Agyapadua',
    ua: 'Вірш',
    ven: 'Vhesi',
    xho: 'Ivesi',
    yor: 'Ẹsẹ',
    zho: '節',
    zul: 'Ivesi',
};

const PARAGRAPH_LABELS: Record<string, string> = {
    // Standard ISO 639-1
    af: 'Paragraaf',
    ar: 'فقرة',
    bg: 'Параграф',
    cs: 'Odstavec',
    da: 'Afsnit',
    de: 'Absatz',
    en: 'Paragraph',
    es: 'Párrafo',
    fa: 'پاراگراف',
    fi: 'Kappale',
    fr: 'Paragraphe',
    ha: 'Sakin magana',
    he: 'פסקה',
    hi: 'अनुच्छेद',
    hr: 'Odlomak',
    hu: 'Bekezdés',
    id: 'Paragraf',
    it: 'Paragrafo',
    ja: '段落',
    ko: '단락',
    ln: 'Paragrafe',
    lv: 'Rindkopa',
    mg: 'Andàlana',
    ml: 'ഖണ്ഡിക',
    mr: 'परिच्छेद',
    ne: 'अनुच्छेद',
    nl: 'Alinea',
    nn: 'Avsnitt',
    no: 'Avsnitt',
    or: 'ଅନୁଚ୍ଛେଦ',
    pa: 'ਪੈਰਾਗ੍ਰਾਫ',
    pl: 'Akapit',
    pt: 'Parágrafo',
    ro: 'Paragraf',
    ru: 'Абзац',
    rw: 'Ingingo',
    sk: 'Odsek',
    sr: 'Pasus',
    st: 'Seripa',
    sv: 'Stycke',
    sw: 'Aya',
    ta: 'பத்தி',
    te: 'పేరా',
    tl: 'Talata',
    tr: 'Paragraf',
    uk: 'Абзац',
    ur: 'پیراگراف',
    vi: 'Đoạn',
    zh: '段',
    zu: 'Isigaba',
    // App-specific codes (non-standard ISO)
    amh: 'አንቀጽ',
    bem: 'Icipande',
    ben: 'অনুচ্ছেদ',
    ceb: 'Parapo',
    cre: 'Paragraf',
    emk: 'Paragrafo',
    ewe: 'Atitri',
    fin: 'Kappale',
    fon: 'Paragraf',
    kde: 'Paragrafu',
    khm: 'កថាខណ្ឌ',
    kng: 'Paragrafu',
    kya: 'Paragrafu',
    lit: 'Paragrafas',
    loz: 'Paragrafu',
    lua: 'Paragrafu',
    lug: 'Paragrafu',
    lve: 'Paragrafu',
    mya: 'စာပိုဒ်',
    nde: 'Indima',
    nso: 'Seripa',
    nya: 'Ndime',
    orm: 'Kophee',
    osh: 'Paragrafu',
    run: 'Ingingo',
    sna: 'Ndima',
    ssw: 'Isigaba',
    teo: 'Paragrafu',
    tng: 'Paragrafu',
    tsn: 'Serapa',
    tso: 'Tihungu',
    tum: 'Ndime',
    tur: 'Paragraf',
    twi: 'Nkyekyɛmu',
    ua: 'Абзац',
    ven: 'Paragrafu',
    xho: 'Isiqendu',
    yor: 'Ìpínrọ̀',
    zho: '段落',
    zul: 'Isigaba',
};

/** Returns e.g. "Verset 5" or "Verse 5" or "Paragraphe 5" based on type + language */
export function buildSegmentAnnouncement(
    type: 'verse' | 'paragraph',
    index: number,
    language: string,
): string {
    const lang = language.split('-')[0].toLowerCase();
    const labels = type === 'verse' ? VERSE_LABELS : PARAGRAPH_LABELS;
    const label = labels[lang] ?? (type === 'verse' ? 'Verse' : 'Paragraph');
    return `${label} ${index}`;
}

// ── Sermon intro phrases (language-specific, for TTS content language) ──

const PREACHED_ON_LABELS: Record<string, string> = {
    af: 'gepreek op',
    amh: 'የተሰበከው',
    ar: 'وُعِظَ في',
    bem: 'yakabaliwa pa',
    ben: 'প্রচারিত',
    ceb: 'gipahayag niadtong',
    cre: 'prèche le',
    cs: 'kázáno dne',
    de: 'gepredigt am',
    emk: 'erekherwa',
    en: 'preached on',
    es: 'predicado el',
    ewe: 'wodzodzodo',
    fa: 'موعظه شده در',
    fin: 'saarnattiin',
    fon: 'nɔ jla',
    fr: 'prêché le',
    hi: 'प्रचारित',
    hr: 'propovijedano',
    hu: 'prédikálva',
    id: 'dikhotbahkan pada',
    it: 'predicato il',
    ja: '説教日',
    kde: 'naliimbirwa',
    khm: 'ប្រកាស​នៅ',
    kng: 'nsambolwa',
    ko: '설교일',
    kya: 'nalalikiriwa',
    lit: 'pamokslyta',
    ln: 'kolakisama',
    loz: 'bulailwe',
    lua: 'nalalikiriwa',
    lug: 'wayigirwa',
    lv: 'sludināts',
    lve: 'nalalikiriwa',
    mg: "notoritana tamin'ny",
    ml: 'പ്രസംഗിച്ചത്',
    mr: 'प्रचारित',
    mya: 'ဟောကြားသည်',
    nde: 'landelwa',
    ne: 'प्रचार गरिएको',
    nl: 'gepreekt op',
    nn: 'forkynt',
    nso: 'go boletšwe',
    nya: "analand'ira",
    or: 'ପ୍ରଚାରିତ',
    orm: 'lallachame',
    osh: 'nalalikiriwa',
    pa: 'ਪ੍ਰਚਾਰਿਤ',
    pl: 'głoszone dnia',
    pt: 'pregado em',
    ro: 'predicat pe',
    ru: 'проповедано',
    run: 'nabwirijwe',
    rw: 'yigishijwe',
    sk: 'kázané dňa',
    sna: 'kuparidzwa',
    sr: 'propovijdano',
    ssw: 'kwentjwe',
    st: 'bolelwa',
    sv: 'predikad',
    sw: 'kuhubiriwa',
    ta: 'பிரசங்கிக்கப்பட்டது',
    te: 'బోధించబడింది',
    teo: 'nalalikiriwa',
    tl: 'ipinagdiwang',
    tng: 'nalalikiriwa',
    tsn: 'go bolelwa',
    tso: 'ku vulavuriwa',
    tum: 'nalalikiriwa',
    tur: 'vaaz edildi',
    twi: 'wakyerɛw',
    ua: 'проповідано',
    ur: 'وعظ کیا گیا',
    ven: 'nalalikiriwa',
    vi: 'giảng ngày',
    xho: 'yakhutshazwa',
    yor: 'wàásù',
    zh: '讲道于',
    zho: '講道於',
    zul: 'kwashunyayelwa',
};

const AT_LOCATION_LABELS: Record<string, string> = {
    af: 'in',
    amh: 'በ',
    ar: 'في',
    bem: 'ku',
    ben: 'এ',
    ceb: 'sa',
    cre: 'nan',
    cs: 'v',
    de: 'in',
    emk: 'ku',
    en: 'at',
    es: 'en',
    ewe: 'le',
    fa: 'در',
    fin: 'paikassa',
    fon: 'ɖò',
    fr: 'à',
    hi: 'में',
    hr: 'u',
    hu: 'a',
    id: 'di',
    it: 'a',
    ja: 'にて',
    kde: 'ku',
    khm: 'នៅ',
    kng: 'ku',
    ko: '에서',
    kya: 'ku',
    lit: 'vietoje',
    ln: 'na',
    loz: 'ku',
    lua: 'ku',
    lug: 'mu',
    lv: 'vietā',
    lve: 'ku',
    mg: 'ao',
    ml: 'ൽ',
    mr: 'येथे',
    mya: 'တွင်',
    nde: 'e',
    ne: 'मा',
    nl: 'in',
    nn: 'i',
    nso: 'go',
    nya: 'ku',
    or: 'ରେ',
    orm: 'iddoo',
    osh: 'ku',
    pa: 'ਵਿੱਚ',
    pl: 'w',
    pt: 'em',
    ro: 'la',
    ru: 'в',
    run: 'i',
    rw: 'i',
    sk: 'v',
    sna: 'ku',
    sr: 'u',
    ssw: 'e',
    st: 'ho',
    sv: 'i',
    sw: 'katika',
    ta: 'இல்',
    te: 'లో',
    teo: 'ku',
    tl: 'sa',
    tng: 'ku',
    tsn: 'go',
    tso: 'ku',
    tum: 'ku',
    tur: "'de",
    twi: 'wɔ',
    ua: 'у',
    ur: 'میں',
    ven: 'ku',
    vi: 'tại',
    xho: 'e',
    yor: 'ní',
    zh: '于',
    zho: '於',
    zul: 'e',
};

const CHAPTER_LABELS: Record<string, string> = {
    af: 'Hoofstuk',
    amh: 'ምዕራፍ',
    ar: 'الإصحاح',
    bem: 'Icipande',
    ben: 'অধ্যায়',
    ceb: 'Kapitulo',
    cre: 'Chapit',
    cs: 'Kapitola',
    de: 'Kapitel',
    emk: 'Sura',
    en: 'Chapter',
    es: 'Capítulo',
    ewe: 'Ŋutilã',
    fa: 'باب',
    fin: 'Luku',
    fon: 'Agbaxo',
    fr: 'Chapitre',
    hi: 'अध्याय',
    hr: 'Poglavlje',
    hu: 'Fejezet',
    id: 'Pasal',
    it: 'Capitolo',
    ja: '章',
    kde: 'Sura',
    khm: 'ជំពូក',
    kng: 'Kanda',
    ko: '장',
    kya: 'Sura',
    lit: 'Skyrius',
    ln: 'Mokapo',
    loz: 'Sikwata',
    lua: 'Nshinda',
    lug: 'Essuula',
    lv: 'Nodaļa',
    lve: 'Sura',
    mg: 'Toko',
    ml: 'അദ്ധ്യായം',
    mr: 'अध्याय',
    mya: 'အခန်း',
    nde: 'Isahluko',
    ne: 'अध्याय',
    nl: 'Hoofdstuk',
    nn: 'Kapittel',
    nso: 'Kgaolo',
    nya: 'Mutu',
    or: 'ଅଧ୍ୟାୟ',
    orm: 'Boqonnaa',
    osh: 'Omukanda',
    pa: 'ਅਧਿਆਇ',
    pl: 'Rozdział',
    pt: 'Capítulo',
    ro: 'Capitol',
    ru: 'Глава',
    run: 'Isahuko',
    rw: 'Igice',
    sk: 'Kapitola',
    sna: 'Chitsauko',
    sr: 'Poglavlje',
    ssw: 'Isahluko',
    st: 'Kgaolo',
    sv: 'Kapitel',
    sw: 'Sura',
    ta: 'அதிகாரம்',
    te: 'అధ్యాయము',
    teo: 'Sura',
    tl: 'Kabanata',
    tng: 'Mutu',
    tsn: 'Kgaolo',
    tso: 'Ndzhawulo',
    tum: 'Mutu',
    tur: 'Bölüm',
    twi: 'Nnwom',
    ua: 'Глава',
    ur: 'باب',
    ven: 'Ndima',
    vi: 'Chương',
    xho: 'Isahluko',
    yor: 'Orí-Ìwé',
    zh: '章',
    zho: '章',
    zul: 'Isahluko',
};

function resolveLang(language: string): string {
    return language.split('-')[0].toLowerCase();
}

/**
 * Builds a sermon intro sentence in the document's own language.
 * e.g. "Absolute, prêché le dimanche 12 novembre 1960, à Kintuki, Inde"
 */
export function buildSermonIntroText(
    title: string,
    dateStr: string | null,
    location: string | null,
    language: string,
): string {
    const lang = resolveLang(language);
    const parts = [title];
    if (dateStr) {
        const preached = PREACHED_ON_LABELS[lang] ?? 'preached on';
        parts.push(`${preached} ${dateStr}`);
    }
    if (location) {
        const at = AT_LOCATION_LABELS[lang] ?? 'at';
        parts.push(`${at} ${location}`);
    }
    return parts.join(', ');
}

/**
 * Returns "Chapitre", "Chapter", "Capítulo", etc. for the given language.
 * Used for both visual headers and TTS intros.
 */
export function getChapterLabel(language: string): string {
    return CHAPTER_LABELS[resolveLang(language)] ?? 'Chapter';
}

/**
 * Builds a Bible chapter intro in the Bible's own language.
 * e.g. "Apocalypse, Chapitre 1"
 */
export function buildBibleChapterIntro(
    bookName: string,
    chapter: string,
    language: string,
): string {
    return `${bookName}, ${getChapterLabel(language)} ${chapter}`;
}
