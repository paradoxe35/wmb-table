import { DatabaseSync } from 'node:sqlite';

const HELLOAO_LANGUAGE_BY_LOCAL_CODE = {
    af: 'afr',
    ar: 'ara',
    cs: 'ces',
    de: 'deu',
    en: 'eng',
    es: 'spa',
    fa: 'fas',
    fr: 'fra',
    hr: 'hrv',
    hu: 'hun',
    id: 'ind',
    it: 'ita',
    ja: 'jpn',
    ko: 'kor',
    mg: 'mlg',
    ne: 'nep',
    nl: 'nld',
    nn: 'nno',
    pa: 'pan',
    pl: 'pol',
    pt: 'por',
    ro: 'ron',
    ru: 'rus',
    sk: 'slk',
    sr: 'srp',
    sv: 'swe',
    sw: 'swh',
    tl: 'tgl',
    ua: 'ukr',
    ur: 'urd',
    vi: 'vie',
    zh: 'zho',
};

export function mapLocalLanguageToHelloaoLanguage(localCode) {
    return HELLOAO_LANGUAGE_BY_LOCAL_CODE[localCode] ?? localCode;
}

export function readSupportedLanguageCodes(dbPath) {
    const db = new DatabaseSync(dbPath, { readonly: true });
    try {
        return db
            .prepare('SELECT code FROM language ORDER BY code')
            .all()
            .map((row) => row.code);
    } finally {
        db.close();
    }
}
