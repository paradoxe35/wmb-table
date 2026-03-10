/**
 * Curated catalog of Sherpa-ONNX Piper TTS models.
 * One recommended model per language for a clean user experience.
 */

export interface SherpaModelEntry {
    /** Language code (ISO 639-1) */
    langCode: string;
    /** Human-readable language name (French UI) */
    langLabel: string;
    /** Model archive name (without .tar.bz2) */
    modelName: string;
    /** Voice/speaker display name */
    voiceName: string;
    /** Download URL */
    url: string;
}

const BASE_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models';

function entry(
    langCode: string,
    langLabel: string,
    modelName: string,
    voiceName: string,
): SherpaModelEntry {
    return {
        langCode,
        langLabel,
        modelName,
        voiceName,
        url: `${BASE_URL}/${modelName}.tar.bz2`,
    };
}

export const SHERPA_MODEL_CATALOG: SherpaModelEntry[] = [
    entry('en', 'Anglais', 'vits-piper-en_US-lessac-medium', 'Lessac'),
    entry('fr', 'Français', 'vits-piper-fr_FR-siwis-medium', 'Siwis'),
    entry('de', 'Allemand', 'vits-piper-de_DE-thorsten-medium', 'Thorsten'),
    entry('es', 'Espagnol', 'vits-piper-es_ES-davefx-medium', 'Davefx'),
    entry('it', 'Italien', 'vits-piper-it_IT-paola-medium', 'Paola'),
    entry('pt', 'Portugais', 'vits-piper-pt_BR-faber-medium', 'Faber'),
    entry('ru', 'Russe', 'vits-piper-ru_RU-irina-medium', 'Irina'),
    entry('zh', 'Chinois', 'vits-piper-zh_CN-huayan-medium', 'Huayan'),
    entry('nl', 'Néerlandais', 'vits-piper-nl_NL-pim-medium', 'Pim'),
    entry('pl', 'Polonais', 'vits-piper-pl_PL-gosia-medium', 'Gosia'),
    entry('uk', 'Ukrainien', 'vits-piper-uk_UA-ukrainian_tts-medium', 'Ukrainian TTS'),
    entry('sv', 'Suédois', 'vits-piper-sv_SE-nst-medium', 'NST'),
    entry('da', 'Danois', 'vits-piper-da_DK-talesyntese-medium', 'Talesyntese'),
    entry('no', 'Norvégien', 'vits-piper-no_NO-talesyntese-medium', 'Talesyntese'),
    entry('fi', 'Finnois', 'vits-piper-fi_FI-harri-medium', 'Harri'),
    entry('tr', 'Turc', 'vits-piper-tr_TR-fahrettin-medium', 'Fahrettin'),
    entry('cs', 'Tchèque', 'vits-piper-cs_CZ-jirka-medium', 'Jirka'),
    entry('ro', 'Roumain', 'vits-piper-ro_RO-mihai-medium', 'Mihai'),
    entry('hu', 'Hongrois', 'vits-piper-hu_HU-anna-medium', 'Anna'),
    entry('el', 'Grec', 'vits-piper-el_GR-rapunzelina-low', 'Rapunzelina'),
    entry('ar', 'Arabe', 'vits-piper-ar_JO-kareem-medium', 'Kareem'),
    entry('hi', 'Hindi', 'vits-piper-hi_IN-pratham-medium', 'Pratham'),
    entry('vi', 'Vietnamien', 'vits-piper-vi_VN-vais1000-medium', 'VAIS1000'),
    entry('id', 'Indonésien', 'vits-piper-id_ID-news_tts-medium', 'News TTS'),
    entry('ka', 'Géorgien', 'vits-piper-ka_GE-natia-medium', 'Natia'),
    entry('sk', 'Slovaque', 'vits-piper-sk_SK-lili-medium', 'Lili'),
    entry('sr', 'Serbe', 'vits-piper-sr_RS-serbski_institut-medium', 'Serbski Institut'),
    entry('ca', 'Catalan', 'vits-piper-ca_ES-upc_ona-medium', 'UPC Ona'),
    entry('sw', 'Swahili', 'vits-piper-sw_CD-lanfrica-medium', 'Lanfrica'),
    entry('is', 'Islandais', 'vits-piper-is_IS-bui-medium', 'Bui'),
];

/** Find catalog entry by language code */
export function findModelByLang(langCode: string): SherpaModelEntry | undefined {
    const code = langCode.split('-')[0].toLowerCase();
    return SHERPA_MODEL_CATALOG.find((m) => m.langCode === code);
}

/** Find catalog entry by model name */
export function findModelByName(modelName: string): SherpaModelEntry | undefined {
    return SHERPA_MODEL_CATALOG.find((m) => m.modelName === modelName);
}
