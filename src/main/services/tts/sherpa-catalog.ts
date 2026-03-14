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
    // European — major
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
    // European — other
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
    // Asian — major
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
    // Asian — South & Southeast
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
    // Central Asian & Caucasian
    kaz: 'kk',
    kir: 'ky',
    tgk: 'tg',
    tat: 'tt',
    aze: 'az',
    uzb: 'uz',
    tuk: 'tk',
    mon: 'mn',
    // African — Swahili variants
    swa: 'sw',
    swh: 'sw',
    // African — other with ISO 639-1
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
    // Other with ISO 639-1
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
