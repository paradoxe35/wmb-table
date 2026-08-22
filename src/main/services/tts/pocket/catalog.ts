export interface PocketModel {
    /** Bundle folder name upstream, and the local model directory name. */
    bundle: string;
    langCode: string;
    displayName: string;
    filesizeMb: number;
}

const ONNX_BASE = 'https://huggingface.co/KevinAHM/pocket-tts-onnx/resolve/main/onnx';
const VOICE_BASE =
    'https://huggingface.co/kyutai/pocket-tts-without-voice-cloning/resolve/main/languages';

/** Downloaded per bundle; the fp32 twins exist upstream but double the size for no gain here. */
export const BUNDLE_FILES = [
    'bundle.json',
    'tokenizer.model',
    'bos_before_voice.npy',
    'text_conditioner_int8.onnx',
    'flow_lm_main_int8.onnx',
    'flow_lm_flow_int8.onnx',
    'mimi_decoder_int8.onnx',
    'mimi_encoder_int8.onnx',
] as const;

export const POCKET_MODELS: PocketModel[] = [
    { bundle: 'english_2026-04', langCode: 'en', displayName: 'Anglais', filesizeMb: 143 },
    { bundle: 'french_24l', langCode: 'fr', displayName: 'Français', filesizeMb: 358 },
    { bundle: 'german', langCode: 'de', displayName: 'Allemand', filesizeMb: 143 },
    { bundle: 'italian', langCode: 'it', displayName: 'Italien', filesizeMb: 143 },
    { bundle: 'portuguese', langCode: 'pt', displayName: 'Portugais', filesizeMb: 143 },
    { bundle: 'spanish', langCode: 'es', displayName: 'Espagnol', filesizeMb: 143 },
];

/** kyutai publishes the same voice set for every language bundle. */
export const POCKET_VOICES = [
    'alba',
    'anna',
    'azelma',
    'bill_boerst',
    'caro_davy',
    'charles',
    'cosette',
    'eponine',
    'estelle',
    'eve',
    'fantine',
    'george',
    'giovanni',
    'jane',
    'javert',
    'jean',
    'juergen',
    'lola',
    'marius',
    'mary',
    'michael',
    'paul',
    'peter_yearsley',
    'rafael',
    'stuart_bell',
    'vera',
] as const;

export const VOICE_SIZE_MB = 32;

export function findModelByBundle(bundle: string): PocketModel | undefined {
    return POCKET_MODELS.find((model) => model.bundle === bundle);
}

export function findModelForLanguage(langCode: string): PocketModel | undefined {
    return POCKET_MODELS.find((model) => model.langCode === langCode);
}

export function bundleFileUrl(bundle: string, file: string): string {
    return `${ONNX_BASE}/${bundle}/${file}`;
}

export function voiceUrl(bundle: string, voice: string): string {
    return `${VOICE_BASE}/${bundle}/embeddings/${voice}.safetensors`;
}
