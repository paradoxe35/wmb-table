import { marked } from 'marked';
import TurndownService from 'turndown';
import { escapeRegExp } from '@shared/searchable';

/** A top-level element of the stored note HTML, paired with its markdown projection. */
export interface NoteBlock {
    html: string;
    markdown: string;
}

export const NOTE_BLOCK_SEPARATOR = '\n\n';

/** Prefix the notes editor uses for in-app references (see editor-view link handling). */
const EDITOR_LINK_PREFIX = 'http://w.t/#wmb/';

const VOID_TAGS = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
]);

const LOSSY_TAGS = new Set(['table', 'sub', 'sup', 'u', 's', 'strike', 'del', 'ins', 'mark']);

const LOSSY_ATTRIBUTE_PATTERN = /\s(style|lang|data-[a-z-]+)\s*=/i;

const turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    hr: '---',
    // Backslash breaks survive the trailing-whitespace trim below; two trailing spaces would not.
    br: '\\',
});

interface HtmlTag {
    name: string;
    closing: boolean;
    selfClosing: boolean;
    end: number;
}

function readTag(html: string, index: number): HtmlTag | null {
    if (html[index] !== '<') return null;

    if (html.startsWith('<!', index)) {
        const commentEnd = html.startsWith('<!--', index) ? html.indexOf('-->', index) : -1;
        const end = commentEnd === -1 ? html.indexOf('>', index) : commentEnd + 2;
        return {
            name: '#comment',
            closing: false,
            selfClosing: true,
            end: end === -1 ? html.length : end + 1,
        };
    }

    let cursor = index + 1;
    const closing = html[cursor] === '/';
    if (closing) cursor++;

    const nameStart = cursor;
    while (cursor < html.length && /[a-zA-Z0-9-]/.test(html[cursor])) cursor++;
    const name = html.slice(nameStart, cursor).toLowerCase();
    if (!name) return null;

    let quote: string | null = null;
    while (cursor < html.length) {
        const char = html[cursor];
        if (quote) {
            if (char === quote) quote = null;
        } else if (char === '"' || char === "'") {
            quote = char;
        } else if (char === '>') {
            cursor++;
            break;
        }
        cursor++;
    }

    return {
        name,
        closing,
        selfClosing: html[cursor - 2] === '/' || VOID_TAGS.has(name),
        end: cursor,
    };
}

function* iterateTags(html: string): Generator<{ name: string; raw: string }> {
    let index = 0;

    while (index < html.length) {
        if (html[index] !== '<') {
            index++;
            continue;
        }

        const tag = readTag(html, index);
        if (!tag) {
            index++;
            continue;
        }

        yield { name: tag.name, raw: html.slice(index, tag.end) };
        index = tag.end;
    }
}

/**
 * Formatting the editor can produce but markdown cannot carry: tables, alignment, indent,
 * colour, underline, strike, sub/superscript, task state, page breaks, language spans.
 * Returns the offending construct so callers can explain the refusal.
 */
export function findUnsupportedFormatting(html: string): string | null {
    for (const tag of iterateTags(html)) {
        if (LOSSY_TAGS.has(tag.name)) return `<${tag.name}>`;

        const attribute = LOSSY_ATTRIBUTE_PATTERN.exec(tag.raw);
        if (attribute) return attribute[1].toLowerCase();
    }

    return null;
}

/**
 * Grouping elements the editor does not model — imported documents wrap whole chapters in
 * them. Splitting inside keeps edits block-scoped instead of rewriting a whole chapter.
 */
const TRANSPARENT_CONTAINERS = new Set(['section', 'article', 'main', 'body', 'html']);

const MAX_UNWRAP_DEPTH = 6;

function unwrapContainer(block: string, depth: number): string[] | null {
    if (depth >= MAX_UNWRAP_DEPTH) return null;

    const tag = readTag(block, 0);
    if (!tag || tag.closing || tag.selfClosing) return null;

    const transparent =
        TRANSPARENT_CONTAINERS.has(tag.name) ||
        // A bare <div> is a wrapper; one carrying data attributes is a real node (page break).
        (tag.name === 'div' && !/\sdata-[a-z-]+\s*=/i.test(block.slice(0, tag.end)));
    if (!transparent) return null;

    const closing = `</${tag.name}>`;
    if (!block.endsWith(closing)) return null;

    const inner = splitBlocks(block.slice(tag.end, block.length - closing.length), depth + 1);
    return inner.length > 0 ? inner : null;
}

/**
 * Split note HTML into its top-level elements. Editor output is a flat list of block
 * elements, so tracking tag depth is enough — no DOM is available in the main process.
 */
export function splitHtmlBlocks(html: string): string[] {
    return splitBlocks(html, 0);
}

function splitBlocks(html: string, depth: number): string[] {
    const blocks: string[] = [];
    let tagDepth = 0;
    let blockStart = -1;
    let index = 0;

    const flush = (end: number) => {
        if (blockStart === -1) return;
        const block = html.slice(blockStart, end).trim();
        if (block) blocks.push(...(unwrapContainer(block, depth) ?? [block]));
        blockStart = -1;
    };

    while (index < html.length) {
        if (html[index] !== '<') {
            if (tagDepth === 0 && blockStart === -1 && html[index].trim()) blockStart = index;
            index++;
            continue;
        }

        const tag = readTag(html, index);
        if (!tag) {
            index++;
            continue;
        }

        if (tagDepth === 0 && !tag.closing) flush(index);
        if (blockStart === -1) blockStart = index;

        if (tag.closing) tagDepth = Math.max(0, tagDepth - 1);
        else if (!tag.selfClosing) tagDepth++;

        index = tag.end;
        if (tagDepth === 0) flush(index);
    }

    flush(html.length);
    return blocks;
}

/**
 * The editor stores references as `http://w.t/#wmb/…` so its click handler can pick them
 * up, but `wmb://` is the form the assistant reads and writes. Converting here keeps the
 * projection in one dialect, so an anchor copied from a note also matches when editing.
 */
function toAssistantMarkdownLinks(markdown: string): string {
    return markdown
        .replace(
            new RegExp(`\\]\\(${escapeRegExp(EDITOR_LINK_PREFIX)}([^)]+)\\)`, 'g'),
            '](wmb://$1)',
        )
        .replace(new RegExp(`<${escapeRegExp(EDITOR_LINK_PREFIX)}([^>]+)>`, 'g'), '<wmb://$1>');
}

/**
 * Trailing whitespace carries no meaning here and the editor emits plenty of it
 * (list items are wrapped in paragraphs), so drop it to keep the projection stable.
 */
function toBlockMarkdown(blockHtml: string): string {
    const markdown = turndown
        .turndown(blockHtml)
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .trim();

    return toAssistantMarkdownLinks(markdown);
}

export function noteHtmlToBlocks(html: string): NoteBlock[] {
    return splitHtmlBlocks(html).map((blockHtml) => ({
        html: blockHtml,
        markdown: toBlockMarkdown(blockHtml),
    }));
}

/**
 * Canonical markdown projection of a note. Blocks are converted independently so the
 * projection stays identical whether a whole note or a single block is converted.
 */
export function noteHtmlToMarkdown(html: string): string {
    return noteHtmlToBlocks(html)
        .map((block) => block.markdown)
        .filter(Boolean)
        .join(NOTE_BLOCK_SEPARATOR);
}

function toEditorMarkdownLinks(markdown: string): string {
    return markdown
        .replace(/`(\[[^\]]+\]\(wmb:\/\/[^)]+\))`/g, '$1')
        .replace(
            /\]\(wmb:\/\/([^)]+)\)/g,
            (_, path: string) => `](${EDITOR_LINK_PREFIX}${path.replace(/ /g, '%20')})`,
        );
}

function toEditorHtmlLinks(html: string): string {
    return html.replace(
        /href="wmb:\/\/([^"]+)"/g,
        (_, path: string) => `href="${EDITOR_LINK_PREFIX}${path}"`,
    );
}

export async function markdownToNoteHtml(markdown: string): Promise<string> {
    const html = await marked.parse(toEditorMarkdownLinks(markdown));
    return toEditorHtmlLinks(html).trim();
}
