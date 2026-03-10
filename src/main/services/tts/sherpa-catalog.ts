import { LANG_LABELS_FR } from '@shared/tts.types';

// ── Types ──

export interface SherpaCatalogEntry {
    id: string;
    engine: string;
    name: string;
    langCode: string;
    langName: string;
    quality: string;
    numSpeakers: number;
    filesizeMb: number;
    url: string;
    modelName: string;
}

// ── ISO 639-3 → 639-1 mapping ──

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
    ara: 'ar',
    hin: 'hi',
    vie: 'vi',
    ind: 'id',
    kat: 'ka',
    slk: 'sk',
    srp: 'sr',
    cat: 'ca',
    swa: 'sw',
    isl: 'is',
    bul: 'bg',
    ben: 'bn',
    fas: 'fa',
    jpn: 'ja',
    kor: 'ko',
    tha: 'th',
    heb: 'he',
    msa: 'ms',
    tam: 'ta',
    tel: 'te',
    mal: 'ml',
    mar: 'mr',
    nep: 'ne',
    sin: 'si',
    ltz: 'lb',
    mkd: 'mk',
    lit: 'lt',
    lav: 'lv',
    est: 'et',
    glg: 'gl',
    eus: 'eu',
    guj: 'gu',
    kan: 'kn',
    hau: 'ha',
    amh: 'am',
    cym: 'cy',
    bel: 'be',
    slv: 'sl',
    hrv: 'hr',
    sqi: 'sq',
};

// ── Pure helpers ──

export function normalizeLangCode(code: string): string {
    const base = code.split('-')[0].toLowerCase();
    return ISO3_TO_ISO1[base] ?? base;
}

export function iso3ToIso1(code: string): string {
    return ISO3_TO_ISO1[code] ?? code;
}

export function getLangLabelFr(langCode: string): string {
    return LANG_LABELS_FR[langCode] ?? LANG_LABELS_FR[iso3ToIso1(langCode)] ?? langCode;
}
