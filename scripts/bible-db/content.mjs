export function collectHelloaoNoteIds(content) {
    const noteIds = new Set();

    for (const item of content ?? []) {
        if (item && typeof item === 'object' && 'noteId' in item && Number.isInteger(item.noteId)) {
            noteIds.add(item.noteId);
        }
    }

    return [...noteIds].sort((left, right) => left - right);
}

const OPENING_PUNCTUATION = /[(\[{'"“‘«]/u;
const CLOSING_PUNCTUATION = /[)\]}.,;:!?%'"”’»]/u;

function needsSpaceBetween(previousChar, nextChar) {
    if (!previousChar || !nextChar) {
        return false;
    }

    if (/\s/u.test(previousChar) || /\s/u.test(nextChar)) {
        return false;
    }

    if (OPENING_PUNCTUATION.test(previousChar)) {
        return false;
    }

    if (CLOSING_PUNCTUATION.test(nextChar)) {
        return false;
    }

    return true;
}

function appendLineBreak(output) {
    return output.endsWith('\n') ? output : `${output}\n`;
}

function appendText(output, text, options = {}) {
    const value = typeof text === 'string' ? text : '';
    if (!value) {
        return output;
    }

    const { forceLineStart = false, indentLevel = 0 } = options;
    let nextOutput = output;

    if (forceLineStart && nextOutput && !nextOutput.endsWith('\n')) {
        nextOutput = appendLineBreak(nextOutput);
    }

    const normalizedText = forceLineStart ? value.trimStart() : value;
    const indent = forceLineStart ? '  '.repeat(Math.max(indentLevel - 1, 0)) : '';
    const previousChar = nextOutput.at(-1) ?? '';
    const nextChar = normalizedText[0] ?? '';

    if (needsSpaceBetween(previousChar, nextChar)) {
        nextOutput += ' ';
    }

    return `${nextOutput}${indent}${normalizedText}`;
}

function appendInlineHeading(output, heading) {
    const normalized = heading.trim();
    if (!normalized) {
        return output;
    }

    let nextOutput = output;
    if (nextOutput && !nextOutput.endsWith('\n')) {
        nextOutput = appendLineBreak(nextOutput);
    }

    nextOutput = appendText(nextOutput, normalized, { forceLineStart: true });
    return appendLineBreak(nextOutput);
}

export function flattenHelloaoContent(content, options = {}) {
    let output = '';

    for (const item of content ?? []) {
        if (typeof item === 'string') {
            output = appendText(output, item);
            continue;
        }

        if (!item || typeof item !== 'object') {
            continue;
        }

        if ('text' in item) {
            output = appendText(output, item.text ?? '', {
                forceLineStart: Number.isInteger(item.poem),
                indentLevel: item.poem ?? 0,
            });
            continue;
        }

        if ('heading' in item) {
            output = appendInlineHeading(output, item.heading ?? '');
            continue;
        }

        if ('lineBreak' in item) {
            output = appendLineBreak(output);
        }
    }

    return options.trim === false ? output : output.trimEnd();
}

export function buildHelloaoChapterVerses(chapterContent, chapterFootnotes) {
    const verses = [];

    for (const item of chapterContent ?? []) {
        if (!item || typeof item !== 'object') {
            continue;
        }

        if (item.type !== 'verse') {
            continue;
        }

        const verseContent = flattenHelloaoContent(item.content ?? []);
        if (!verseContent) {
            continue;
        }

        verses.push({
            verse: String(item.number),
            content: verseContent,
            footnotes: selectHelloaoFootnotesForVerse(item.content ?? [], chapterFootnotes ?? []),
        });
    }

    return verses;
}

export function selectHelloaoFootnotesForVerse(content, footnotes) {
    const noteIds = new Set(collectHelloaoNoteIds(content));
    if (noteIds.size === 0) {
        return [];
    }

    return (footnotes ?? []).filter((footnote) => noteIds.has(footnote.noteId));
}
