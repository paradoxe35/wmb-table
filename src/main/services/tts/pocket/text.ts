import type { PocketBundle } from './types';
import type { SentencePieceTokenizer } from './sentencepiece';

const SENTENCE = /[^.!?]+[.!?]+|[^.!?]+$/g;
const SHORT_INPUT_WORDS = 5;

export interface PreparedText {
    chunks: string[];
    framesAfterEos: number;
}

function normalizePrompt(text: string, bundle: PocketBundle): string {
    let prompt = text
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!prompt) return '';

    if (bundle.remove_semicolons) prompt = prompt.replaceAll(';', ',');
    if (!/[A-ZÀ-Þ]/.test(prompt[0])) prompt = prompt[0].toUpperCase() + prompt.slice(1);
    if (/[0-9A-Za-zÀ-ÿ]/.test(prompt.at(-1)!)) prompt += '.';

    const words = prompt.split(/\s+/).filter(Boolean).length;
    if (bundle.pad_with_spaces_for_short_inputs && words < SHORT_INPUT_WORDS) {
        prompt = ' '.repeat(8) + prompt;
    }
    return prompt;
}

function framesAfterEos(text: string, bundle: PocketBundle): number {
    if (bundle.model_recommended_frames_after_eos != null) {
        return bundle.model_recommended_frames_after_eos;
    }
    return text.split(/\s+/).filter(Boolean).length <= 4 ? 3 : 1;
}

/**
 * The model degrades on long prompts, so text is cut on sentence boundaries and only split
 * mid-sentence when a single sentence exceeds the bundle's token budget.
 */
export function prepareText(
    text: string,
    bundle: PocketBundle,
    tokenizer: SentencePieceTokenizer,
): PreparedText {
    const prompt = normalizePrompt(text, bundle);
    if (!prompt) return { chunks: [], framesAfterEos: 1 };

    const limit = bundle.max_token_per_chunk;
    const sentences =
        prompt
            .match(SENTENCE)
            ?.map((s) => s.trim())
            .filter(Boolean) ?? [];
    const chunks: string[] = [];
    let pending = '';

    const flush = () => {
        if (pending) chunks.push(pending.trim());
        pending = '';
    };

    for (const sentence of sentences) {
        const ids = tokenizer.encode(sentence);
        if (ids.length > limit) {
            flush();
            for (let i = 0; i < ids.length; i += limit) {
                const piece = tokenizer.decode(ids.slice(i, i + limit)).trim();
                if (piece) chunks.push(piece);
            }
            continue;
        }

        if (!pending) {
            pending = sentence;
            continue;
        }

        const combined = `${pending} ${sentence}`;
        if (tokenizer.encode(combined).length > limit) {
            flush();
            pending = sentence;
        } else {
            pending = combined;
        }
    }
    flush();

    return {
        chunks: chunks.length > 0 ? chunks : [prompt],
        framesAfterEos: framesAfterEos(prompt, bundle),
    };
}
