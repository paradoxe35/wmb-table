import initSentencex, { get_sentence_boundaries } from 'sentencex-wasm';
import { hasSpeakableContent, type TtsSegment } from '@shared/tts.types';

interface Boundary {
    start_index: number;
    end_index: number;
    text: string;
}

const MIN_SEGMENT_CHARS = 40;
const MAX_SEGMENT_CHARS = 400;

let sentencexReady: Promise<void> | null = null;

function ensureSentencexReady(): Promise<void> {
    sentencexReady ??= initSentencex().then(() => undefined);
    return sentencexReady;
}

function stripMarkers(content: string): { clean: string; posMap: number[] } {
    const posMap: number[] = [];
    let clean = '';
    for (let i = 0; i < content.length; i++) {
        const c = content[i];
        if (c !== '*' && c !== '^') {
            posMap.push(i);
            clean += c;
        }
    }
    return { clean, posMap };
}

function mergeBoundaries(raw: Boundary[]): Boundary[] {
    if (raw.length <= 1) return raw;

    const merged: Boundary[] = [];
    let acc: Boundary | null = null;

    for (const b of raw) {
        const trimmed = b.text.trim();
        if (!trimmed || !hasSpeakableContent(trimmed)) continue;

        if (!acc) {
            acc = { ...b };
            continue;
        }

        const accText = acc.text.trim();
        const accLen = accText.length;
        const bLen = trimmed.length;
        const endsWithEllipsis = accText.endsWith('...');

        if (
            (accLen < MIN_SEGMENT_CHARS || bLen < MIN_SEGMENT_CHARS || endsWithEllipsis) &&
            accLen + bLen + 1 <= MAX_SEGMENT_CHARS
        ) {
            acc = {
                start_index: acc.start_index,
                end_index: b.end_index,
                text: acc.text + ' ' + b.text,
            };
        } else {
            merged.push(acc);
            acc = { ...b };
        }
    }

    if (acc) merged.push(acc);
    return merged;
}

function paragraphAsSingleSegment(
    index: number,
    content: string,
    text: string,
    paragraphIndex: number,
): TtsSegment {
    return {
        index,
        text: text.replace(/\s+/g, ' '),
        paragraphIndex,
        startOffset: 0,
        endOffset: content.length,
    };
}

export async function segmentParagraphsBySentence(
    paragraphs: { paragraphIndex: number; content: string }[],
    language: string,
): Promise<TtsSegment[]> {
    let index = 0;
    const segments: TtsSegment[] = [];

    try {
        await ensureSentencexReady();
    } catch (err) {
        console.error(
            '[TTS] Failed to initialize sentencex-wasm, falling back to single-segment mode:',
            err,
        );
        for (const p of paragraphs) {
            const text = p.content.replace(/[*^]/g, '').replace(/\s+/g, ' ').trim();
            if (!text || !hasSpeakableContent(text)) continue;
            segments.push(paragraphAsSingleSegment(index++, p.content, text, p.paragraphIndex));
        }
        return segments;
    }

    for (const p of paragraphs) {
        if (!p.content.trim()) continue;
        const { clean, posMap } = stripMarkers(p.content);
        const text = clean.trim();
        if (!text || !hasSpeakableContent(text)) continue;

        let rawBoundaries: Boundary[];
        try {
            rawBoundaries = get_sentence_boundaries(language, clean) as Boundary[];
        } catch (err) {
            console.error('[TTS] sentencex-wasm failed to segment paragraph, using fallback:', err);
            segments.push(paragraphAsSingleSegment(index++, p.content, text, p.paragraphIndex));
            continue;
        }

        const boundaries = mergeBoundaries(rawBoundaries);

        for (const b of boundaries) {
            const sentenceText = b.text.trim();
            if (!sentenceText || !hasSpeakableContent(sentenceText)) continue;
            const startOffset = posMap[b.start_index] ?? 0;
            const endOffset =
                b.end_index > 0
                    ? (posMap[b.end_index - 1] ?? p.content.length - 1) + 1
                    : p.content.length;

            segments.push({
                index: index++,
                text: sentenceText,
                paragraphIndex: p.paragraphIndex,
                startOffset,
                endOffset,
            });
        }
    }

    return segments;
}
