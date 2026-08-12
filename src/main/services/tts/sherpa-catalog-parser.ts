import {
    isLanguageCode,
    isVoiceQuality,
    normalizeLanguageCode,
    TTS_MODEL_PRECISIONS,
    TTS_VOICE_QUALITIES,
} from '@shared/tts.types';
import type { SherpaCatalogEntry } from './sherpa-catalog';

/**
 * Turns a sherpa-onnx release asset into a catalog entry. The release is the only
 * machine-readable model list upstream publishes, so everything but the download size has
 * to be read out of the asset name.
 */

const TARBALL_SUFFIX = '.tar.bz2';

const NON_MODEL_NAMES = /^(espeak-ng-data|lexicon|checksum|prompt)/;

/** Prefix -> engine, longest prefix first so `vits-melo` beats `vits`. */
const ENGINE_PREFIXES: [string, string][] = [
    ['sherpa-onnx-zipvoice', 'zipvoice'],
    ['sherpa-onnx-supertonic', 'supertonic'],
    ['sherpa-onnx-pocket', 'pocket'],
    ['sherpa-onnx-vits', 'vits'],
    ['matcha-icefall', 'icefall'],
    ['matcha-tts', 'matcha'],
    ['vits-cantonese', 'cantonese'],
    ['vits-icefall', 'icefall'],
    ['vits-inflect', 'inflect'],
    ['vits-mimic3', 'mimic3'],
    ['vits-piper', 'piper'],
    ['vits-coqui', 'coqui'],
    ['vits-melo', 'melo'],
    ['vits-vctk', 'vctk'],
    ['vits-mms', 'mms'],
    ['vits-ljs', 'ljs'],
    ['vits-zh', 'zh'],
    ['kokoro', 'kokoro'],
    ['kitten', 'kitten'],
];

/**
 * Multilingual models whose asset name mentions none of their languages. Keyed by name
 * prefix because a later revision of the same engine can widen its language support.
 */
const FIXED_MODEL_LANGUAGES: [string, string[]][] = [
    [
        'sherpa-onnx-supertonic-3',
        [
            'ar',
            'bg',
            'cs',
            'da',
            'de',
            'el',
            'en',
            'es',
            'et',
            'fi',
            'fr',
            'hi',
            'hr',
            'hu',
            'id',
            'it',
            'ja',
            'ko',
            'lt',
            'lv',
            'nl',
            'pl',
            'pt',
            'ro',
            'ru',
            'sk',
            'sl',
            'sv',
            'tr',
            'uk',
            'vi',
        ],
    ],
    ['sherpa-onnx-supertonic', ['en', 'ko', 'es', 'pt', 'fr']],
    ['sherpa-onnx-pocket', ['en', 'zh']],
];

/** Single-language engines whose asset name does not carry the language either. */
const FIXED_ENGINE_LANGUAGES: Record<string, string[]> = {
    cantonese: ['yue'],
    ljs: ['en'],
    vctk: ['en'],
    zh: ['zh'],
    kitten: ['en'],
};

/** Framework prefixes that sit in front of the engine name in an asset. */
const FRAMEWORK_PREFIXES = ['sherpa-onnx-', 'vits-', 'matcha-'];

/**
 * Known prefixes first, then the naming convention itself: an asset is
 * `[framework-]<engine>-<rest>`, so an engine nobody has seen yet still gets its own name
 * instead of being lumped in with vits.
 */
function detectEngine(modelName: string): { engine: string; prefix: string } {
    for (const [prefix, engine] of ENGINE_PREFIXES) {
        if (modelName.startsWith(prefix)) return { engine, prefix };
    }

    const framework = FRAMEWORK_PREFIXES.find((candidate) => modelName.startsWith(candidate));
    const rest = framework ? modelName.slice(framework.length) : modelName;
    const engine = rest.split('-')[0] ?? '';

    return engine && !isLanguageCode(engine)
        ? { engine, prefix: `${framework ?? ''}${engine}` }
        : { engine: 'vits', prefix: framework ?? '' };
}

/** Last match wins: the tail of an asset name is where these suffixes live. */
function lastToken<T extends string>(tokens: string[], is: (t: string) => t is T): T | undefined {
    return [...tokens].reverse().find(is);
}

/**
 * `en_US` and `zh_en` both appear; the first is a locale, the second a language pair. The
 * region is kept: pt_BR and pt_PT would otherwise be two identical rows. Anything matching
 * a model to a language folds it back away.
 */
function parseLocaleToken(token: string): string[] {
    const parts = token.split(/[_-]/).filter(Boolean);
    if (parts.length === 0) return [];

    const [language, region] = parts;
    if (parts.length === 2 && /^[A-Z]{2}$/.test(region)) {
        const base = normalizeLanguageCode(language);
        return isLanguageCode(base) ? [`${base}-${region}`] : [];
    }

    return [...new Set(parts.map(normalizeLanguageCode))].filter(isLanguageCode);
}

function detectLanguages(engine: string, prefix: string, modelName: string): string[] {
    const override = FIXED_MODEL_LANGUAGES.find(([name]) => modelName.startsWith(name));
    if (override) return override[1];

    const fixed = FIXED_ENGINE_LANGUAGES[engine];
    if (fixed) return fixed;

    if (engine === 'kokoro') return modelName.includes('multi-lang') ? ['en', 'zh'] : ['en'];

    const rest = modelName.slice(prefix.length).replace(/^-/, '');
    const tokens = rest.split('-').filter(Boolean);

    if (engine === 'melo') {
        return parseLocaleToken(tokens[1] ?? tokens[0] ?? '');
    }

    if (engine === 'zipvoice' || engine === 'matcha') {
        const codes = tokens
            .flatMap(parseLocaleToken)
            .filter((code) => normalizeLanguageCode(code).length === 2);
        return codes.length > 0 ? [...new Set(codes)] : ['en'];
    }

    for (const token of tokens) {
        const codes = parseLocaleToken(token);
        if (codes.length > 0) return codes;
    }

    return [];
}

const TECHNICAL_TOKENS = new Set([
    ...TTS_VOICE_QUALITIES,
    ...TTS_MODEL_PRECISIONS,
    'tts',
    'hf',
    'v2',
]);

/**
 * What is left of the asset name once the parts shown elsewhere — language, quality tier,
 * file format — are taken out. A speaker name can itself read as a language code (`SA_dii`
 * as Sanskrit), so a token only counts as one when this model actually speaks it.
 */
function detectVoiceName(prefix: string, modelName: string, languages: string[]): string {
    const rest = modelName.slice(prefix.length).replace(/^-/, '');
    const spoken = new Set(languages.map(normalizeLanguageCode));

    const namesSpokenLanguage = (token: string) => {
        if (spoken.has(token)) return true;
        const codes = parseLocaleToken(token).map(normalizeLanguageCode);
        return codes.length > 0 && codes.every((code) => spoken.has(code));
    };

    const tokens = rest
        .split('-')
        .filter(Boolean)
        .filter((token) => !TECHNICAL_TOKENS.has(token) && !namesSpokenLanguage(token));

    return tokens.join('-') || modelName;
}

export function toMegabytes(bytes: number): number {
    return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

export function parseSherpaAsset(
    assetName: string,
    sizeBytes: number,
    url: string,
): SherpaCatalogEntry | null {
    if (!assetName.endsWith(TARBALL_SUFFIX)) return null;

    const modelName = assetName.slice(0, -TARBALL_SUFFIX.length);
    if (NON_MODEL_NAMES.test(modelName)) return null;

    const { engine, prefix } = detectEngine(modelName);
    const languages = detectLanguages(engine, prefix, modelName);
    // Everything is matched and listed by language; an entry without one is unusable.
    if (languages.length === 0) return null;

    const tokens = modelName.split('-').filter(Boolean);
    const quality = lastToken(tokens, isVoiceQuality);

    return {
        engine,
        name: detectVoiceName(prefix, modelName, languages),
        langCode: languages,
        ...(quality ? { quality } : {}),
        filesizeMb: toMegabytes(sizeBytes),
        url,
        modelName,
    };
}
