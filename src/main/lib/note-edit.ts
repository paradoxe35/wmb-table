import {
    findUnsupportedFormatting,
    markdownToNoteHtml,
    noteHtmlToBlocks,
    noteHtmlToMarkdown,
    NOTE_BLOCK_SEPARATOR,
} from './note-markdown';

export interface NoteEdit {
    oldText: string;
    newText: string;
    replaceAll?: boolean;
}

export interface NoteEditSuccess {
    html: string;
    replacements: number;
}

export interface NoteEditFailure {
    error: string;
}

export type NoteEditOutcome = NoteEditSuccess | NoteEditFailure;

const MARKDOWN_LINK_PATTERN = /!?\[[^\]\n]*\]\([^)\n]*\)/g;

const SNIPPET_PREVIEW_LENGTH = 80;

/** A rendered block, or — while an edit is being applied — a pending one with no HTML yet. */
interface Entry {
    html: string;
    markdown: string;
}

interface Span {
    index: number;
    start: number;
    end: number;
}

interface Match {
    start: number;
    end: number;
}

function preview(text: string): string {
    const singleLine = text.replace(/\s+/g, ' ').trim();
    return singleLine.length <= SNIPPET_PREVIEW_LENGTH
        ? singleLine
        : `${singleLine.slice(0, SNIPPET_PREVIEW_LENGTH)}…`;
}

function buildDocument(entries: Entry[]): { markdown: string; spans: Span[] } {
    const spans: Span[] = [];
    let markdown = '';

    entries.forEach((entry, index) => {
        if (!entry.markdown) return;
        if (markdown) markdown += NOTE_BLOCK_SEPARATOR;
        spans.push({ index, start: markdown.length, end: markdown.length + entry.markdown.length });
        markdown += entry.markdown;
    });

    return { markdown, spans };
}

function findExactMatches(haystack: string, needle: string): Match[] {
    const matches: Match[] = [];
    let from = 0;

    for (;;) {
        const at = haystack.indexOf(needle, from);
        if (at === -1) break;
        matches.push({ start: at, end: at + needle.length });
        from = at + needle.length;
    }

    return matches;
}

interface NormalizedText {
    text: string;
    starts: number[];
    ends: number[];
}

/**
 * Collapse whitespace runs while keeping a map back to source offsets, so an anchor the
 * model re-wrapped or re-indented still resolves to the exact original range.
 */
function normalize(value: string): NormalizedText {
    const chars: string[] = [];
    const starts: number[] = [];
    const ends: number[] = [];
    let index = 0;

    while (index < value.length) {
        if (!/\s/.test(value[index])) {
            chars.push(value[index]);
            starts.push(index);
            ends.push(index + 1);
            index++;
            continue;
        }

        let runEnd = index;
        while (runEnd < value.length && /\s/.test(value[runEnd])) runEnd++;
        if (chars.length > 0) {
            chars.push(' ');
            starts.push(index);
            ends.push(runEnd);
        }
        index = runEnd;
    }

    while (chars[chars.length - 1] === ' ') {
        chars.pop();
        starts.pop();
        ends.pop();
    }

    return { text: chars.join(''), starts, ends };
}

function findNormalizedMatches(haystack: string, needle: string): Match[] {
    const source = normalize(haystack);
    const target = normalize(needle);
    if (!target.text) return [];

    const matches: Match[] = [];
    let from = 0;

    for (;;) {
        const at = source.text.indexOf(target.text, from);
        if (at === -1) break;
        matches.push({ start: source.starts[at], end: source.ends[at + target.text.length - 1] });
        from = at + target.text.length;
    }

    return matches;
}

function findMatches(haystack: string, needle: string): Match[] {
    const exact = findExactMatches(haystack, needle);
    return exact.length > 0 ? exact : findNormalizedMatches(haystack, needle);
}

/**
 * Rewriting part of a `[label](url)` would turn the reference into escaped text and lose it.
 * Replacing the whole link, or text within its label or its URL, stays safe.
 */
function splitsLink(markdown: string, start: number, end: number): boolean {
    for (const link of markdown.matchAll(MARKDOWN_LINK_PATTERN)) {
        const raw = link[0];
        const linkStart = link.index;
        const linkEnd = linkStart + raw.length;
        const labelStart = linkStart + raw.indexOf('[') + 1;
        const labelEnd = linkStart + raw.lastIndexOf('](');

        const outside = end <= linkStart || start >= linkEnd;
        const wholeLink = start <= linkStart && end >= linkEnd;
        const insideLabel = start >= labelStart && end <= labelEnd;
        const insideUrl = start >= labelEnd + 2 && end <= linkEnd - 1;

        if (!outside && !wholeLink && !insideLabel && !insideUrl) return true;
    }

    return false;
}

function applyMatch(entries: Entry[], match: Match, newText: string): Entry[] | NoteEditFailure {
    const { spans } = buildDocument(entries);
    const touched = spans.filter((span) => span.start < match.end && span.end > match.start);
    const first = touched[0];
    const last = touched[touched.length - 1];
    if (!first || !last) {
        return { error: 'Edit could not be located in the note.' };
    }

    const range = entries.slice(first.index, last.index + 1);
    const unsupported = range
        .map((entry) => findUnsupportedFormatting(entry.html))
        .find((found) => found !== null);
    if (unsupported) {
        return {
            error: `This part of the note uses formatting that markdown cannot carry (${unsupported}). Editing it here would drop that formatting — use updateNoteContent to rewrite the note.`,
        };
    }

    const rangeMarkdown = range
        .map((entry) => entry.markdown)
        .filter(Boolean)
        .join(NOTE_BLOCK_SEPARATOR);

    if (splitsLink(rangeMarkdown, match.start - first.start, match.end - first.start)) {
        return {
            error: 'The anchor cuts through a markdown link. Include the whole `[label](url)` link in oldText.',
        };
    }

    const merged: Entry = {
        html: '',
        markdown: (
            rangeMarkdown.slice(0, match.start - first.start) +
            newText +
            rangeMarkdown.slice(match.end - first.start)
        ).trim(),
    };

    return [...entries.slice(0, first.index), merged, ...entries.slice(last.index + 1)];
}

/**
 * Render the blocks an edit just rewrote. Doing this between edits keeps a batch behaving
 * exactly like the same edits sent one at a time.
 */
async function renderPendingEntries(entries: Entry[]): Promise<Entry[]> {
    return Promise.all(
        entries.map(async (entry) => {
            if (entry.html) return entry;
            const html = await markdownToNoteHtml(entry.markdown);
            return { html, markdown: noteHtmlToMarkdown(html) };
        }),
    );
}

/**
 * Apply anchor-based edits to stored note HTML. Only the blocks an edit touches are
 * re-rendered from markdown; every other block keeps its original HTML.
 */
export async function applyNoteEdits(html: string, edits: NoteEdit[]): Promise<NoteEditOutcome> {
    let entries: Entry[] = noteHtmlToBlocks(html);
    let replacements = 0;

    for (const [position, edit] of edits.entries()) {
        const label = `Edit ${position + 1}`;
        const oldText = edit.oldText.trim();
        const newText = edit.newText.trim();
        if (!oldText) {
            return { error: `${label}: oldText is empty.` };
        }

        const { markdown } = buildDocument(entries);
        const matches = findMatches(markdown, oldText);

        if (matches.length === 0) {
            return {
                error: `${label}: "${preview(oldText)}" was not found in the note. Read the note again with getNoteById and copy the snippet exactly.`,
            };
        }
        if (matches.length > 1 && !edit.replaceAll) {
            return {
                error: `${label}: "${preview(oldText)}" matches ${matches.length} places. Add surrounding text to make it unique, or set replaceAll.`,
            };
        }

        for (const match of [...matches].reverse()) {
            const applied = applyMatch(entries, match, newText);
            if ('error' in applied) {
                return { error: `${label}: ${applied.error}` };
            }
            entries = applied;
            replacements++;
        }

        entries = await renderPendingEntries(entries);
    }

    return {
        html: entries
            .map((entry) => entry.html)
            .filter(Boolean)
            .join('\n'),
        replacements,
    };
}
