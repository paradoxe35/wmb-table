import { isLanguageCode, normalizeLanguageCode } from '@shared/tts.types';
import type { SherpaCatalogEntry } from './sherpa-catalog';

/**
 * Turns a sherpa-onnx release asset into a catalog entry. The release is the only
 * machine-readable model list upstream publishes, so everything but the download size has
 * to be read out of the asset name.
 */

const TARBALL_SUFFIX = '.tar.bz2';

const NON_MODEL_NAMES = /^(espeak-ng-data|lexicon|checksum|prompt)/;

const QUALITY_SUFFIXES = ['x_low', 'x-low', 'low', 'medium', 'high', 'fp16', 'fp32', 'int8'];

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

function detectQuality(tokens: string[]): string {
    for (const token of [...tokens].reverse()) {
        if (QUALITY_SUFFIXES.includes(token)) return token;
    }
    return 'unknown';
}

/** `en_US` and `zh_en` both appear; the first is a locale, the second a language pair. */
function parseLocaleToken(token: string): string[] {
    const parts = token.split(/[_-]/).filter(Boolean);
    if (parts.length === 0) return [];

    const looksLikeRegion = parts.length === 2 && /^[A-Z]{2}$/.test(parts[1]);
    const codes = looksLikeRegion ? [parts[0]] : parts;

    return [...new Set(codes.map(normalizeLanguageCode))].filter(isLanguageCode);
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
        const codes = tokens.flatMap(parseLocaleToken).filter((code) => code.length === 2);
        return codes.length > 0 ? [...new Set(codes)] : ['en'];
    }

    for (const token of tokens) {
        const codes = parseLocaleToken(token);
        if (codes.length > 0) return codes;
    }

    return ['en'];
}

function detectVoiceName(prefix: string, modelName: string, languages: string[]): string {
    const rest = modelName.slice(prefix.length).replace(/^-/, '');
    const dropped = new Set([...languages, ...QUALITY_SUFFIXES, 'tts', 'hf', 'v2']);

    const tokens = rest
        .split('-')
        .filter(Boolean)
        .filter((token) => !dropped.has(token) && parseLocaleToken(token).length === 0);

    return tokens.join('-') || rest || modelName;
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
    const quality = detectQuality(modelName.split('-').filter(Boolean));
    const name = detectVoiceName(prefix, modelName, languages);

    return {
        id: modelName,
        engine,
        name,
        langCode: languages,
        quality,
        numSpeakers: 1,
        filesizeMb: Math.round((sizeBytes / 1024 / 1024) * 100) / 100,
        url,
        modelName,
    };
}
