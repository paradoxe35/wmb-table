import type { VerseSpan } from '@main/database/repositories/ai-bible.repository';

export interface PassageRange {
    chapter: number;
    /** Undefined means the whole chapter. */
    verses?: VerseSpan;
}

const RANGE = /^\D*(\d+)\s*[-‐‑‒–—]\s*(\d+)\D*$/;

function numbersIn(value: string): number[] {
    return (value.match(/\d+/g) ?? []).map(Number);
}

function parseChapter(raw: string): number | { error: string } {
    const numbers = numbersIn(raw);
    if (numbers.length === 1 && numbers[0] >= 1) return numbers[0];
    if (numbers.length > 1) {
        return {
            error: `Invalid chapter: "${raw}". Give one chapter number (e.g. "3") and request each chapter separately.`,
        };
    }
    return { error: `Invalid chapter: "${raw}". Provide a number (e.g. "3").` };
}

function parseFromVerse(raw: string): VerseSpan | { error: string } {
    const numbers = numbersIn(raw);
    if (numbers.length === 1) return { from: numbers[0], to: numbers[0] };

    const range = raw.match(RANGE);
    if (range) return { from: Number(range[1]), to: Number(range[2]) };

    return {
        error: `Invalid verse number: "${raw}". Provide a number (e.g. "16"), or a range with fromVerse "16" and toVerse "18".`,
    };
}

function parseToVerse(raw: string): number | { error: string } {
    const numbers = numbersIn(raw);
    if (numbers.length === 1) return numbers[0];
    return { error: `Invalid toVerse: "${raw}". Provide a single verse number (e.g. "18").` };
}

function present(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

/**
 * Reads the chapter and verse fields a model sends. A range written in one field ("16-18")
 * is split; anything that would silently join digits ("3-4" as chapter 34) is rejected.
 */
export function parsePassageRange(input: {
    chapter: string;
    fromVerse?: string;
    toVerse?: string;
}): PassageRange | { error: string } {
    const chapter = parseChapter(input.chapter);
    if (typeof chapter !== 'number') return chapter;

    const fromText = present(input.fromVerse);
    const toText = present(input.toVerse);
    if (!fromText) {
        if (toText) {
            return {
                error: `toVerse "${toText}" needs a fromVerse. Send fromVerse too (e.g. fromVerse "1", toVerse "${toText}").`,
            };
        }
        return { chapter };
    }

    const span = parseFromVerse(fromText);
    if ('error' in span) return span;

    if (toText) {
        const to = parseToVerse(toText);
        if (typeof to !== 'number') return to;
        if (span.from !== span.to && span.to !== to) {
            return {
                error: `fromVerse "${fromText}" already ends at verse ${span.to}, but toVerse is "${toText}". Send one range.`,
            };
        }
        span.to = to;
    }

    if (span.from < 1) {
        return { error: `Invalid verse number: "${fromText}". Verses start at 1.` };
    }
    if (span.to < span.from) {
        return {
            error: `The range ends (verse ${span.to}) before it starts (verse ${span.from}). Use fromVerse for the first verse.`,
        };
    }

    return { chapter, verses: span };
}
