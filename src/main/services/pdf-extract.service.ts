import { getDocumentProxy } from 'unpdf';

/**
 * Extract readable paragraph text from a PDF using PDF.js text items.
 *
 * `unpdf.extractText()` flattens page text too early for custom import use cases.
 * Here we keep positional text items, rebuild lines, drop repeated headers/footers,
 * and then merge wrapped lines into paragraphs.
 */
const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export type PdfTextItem = {
    str?: string;
    hasEOL?: boolean;
    transform?: number[];
    width?: number;
    height?: number;
    fontName?: string;
    dir?: string;
};

type PositionedText = {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    hasEOL: boolean;
    font: string;
    rtl: boolean;
};

export type PositionedLine = {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    /**
     * The PDF's own font identifier for most of the line. It is opaque — PDF.js
     * reports a generated name, not the typeface — but it is stable within a
     * document, which is all that comparing a line against the body text needs.
     */
    font?: string;
    /** The line reads right to left. */
    rtl?: boolean;
};

/**
 * Media box plus the page's own `/Rotate`. Text item coordinates are stored
 * unrotated, so anything reasoning about visual layout has to rotate them back.
 */
export type PageGeometry = {
    width: number;
    height: number;
    rotate: number;
};

type PageMode = 'prose' | 'structured';

export function normalizeInlineWhitespace(text: string): string {
    return text
        .replace(/\u00a0/g, ' ')
        .split('\t')
        .map((segment) => segment.replace(/ {2,}/g, ' ').trim())
        .join('\t')
        .replace(/\t{2,}/g, '\t')
        .trim();
}

export function normalizeMarginCandidate(text: string): string {
    return text
        .toLowerCase()
        .replace(/\p{Nd}+/gu, '#')
        .replace(/[^\p{L}\p{N}# ]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isTableLikeLine(text: string): boolean {
    return /\t/.test(text) || /\s{3,}/.test(text);
}

function isBulletLikeLine(text: string): boolean {
    return /^([-*•▪◦]|\p{Nd}+[.)]|\p{L}[.)])\s+/u.test(text);
}

/** Digits are `\p{Nd}`: a Persian book prints `۱`, which `\d` never matches. */
export function isLikelyTocLine(text: string): boolean {
    return (
        /\t/.test(text) ||
        /\.{2,}\s*\p{Nd}+\s*$/u.test(text) ||
        /^(?:\p{Nd}+|[ivxlcdm]+)\b.+\p{Nd}+\s*$/iu.test(text) ||
        /^\p{L}+\s+(?:\p{Nd}+|[ivxlcdm]+)\b.+\p{Nd}+\s*$/iu.test(text)
    );
}

function startsWithQuote(text: string): boolean {
    return /^["'`“‘«「『（《【]/u.test(text);
}

function isLikelyHeading(text: string): boolean {
    if (text.length === 0 || text.length > 120) return false;
    if (isBulletLikeLine(text)) return false;
    const letters = text.replace(/[^\p{L}]/gu, '');
    if (letters.length < 4) return false;
    const uppercaseLetters = letters.replace(/[^\p{Lu}]/gu, '').length;
    if (uppercaseLetters === 0) return false;
    return uppercaseLetters / letters.length > 0.8;
}

export function isStandalonePageNumber(text: string): boolean {
    return (
        /^(page\s+)?\p{Nd}+([/-]\p{Nd}+)?$/iu.test(text) || /^\p{Nd}+\s+of\s+\p{Nd}+$/iu.test(text)
    );
}

export function countMatches(text: string, pattern: RegExp): number {
    return [...text.matchAll(pattern)].length;
}

function isCjkDominant(text: string): boolean {
    const cjkCount = countMatches(
        text,
        /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu,
    );
    if (cjkCount < 2) return false;

    const latinLetterCount = countMatches(text, /\p{Script=Latin}/gu);
    return cjkCount >= latinLetterCount;
}

function endsWithTerminalPunctuation(text: string): boolean {
    return /[.!?…:;。！？：；]["'»”’）\]」』】》)]*$/u.test(text);
}

function startsLikeSentence(text: string): boolean {
    return /^[\p{Lu}\p{Nd}«"'(“‘「『（《【\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
        text,
    );
}

function shouldPreferCjkParagraphBreak(
    previousLine: string,
    nextLine: string,
    medianLength: number,
): boolean {
    if (!isCjkDominant(previousLine) && !isCjkDominant(nextLine)) {
        return false;
    }

    if (!endsWithTerminalPunctuation(previousLine) || !startsLikeSentence(nextLine)) {
        return false;
    }

    const previousWasShort = previousLine.length < Math.max(24, medianLength * 0.8);
    const nextWasShort = nextLine.length < Math.max(30, medianLength);

    return startsWithQuote(nextLine) || previousWasShort || nextWasShort;
}

export function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * PDF text items are laid out in visual order. In a right-to-left line that is
 * the reverse of reading order, so the items are flipped — except for runs that
 * are themselves left-to-right (numbers, Latin names), which keep their order.
 * This is the reordering step of the bidirectional algorithm, and it needs no
 * knowledge of the language: PDF.js reports the direction of every item.
 */
function toLogicalOrder(items: PositionedText[]): PositionedText[] {
    if (items.filter((item) => item.rtl).length * 2 <= items.length) return items;

    const logical: PositionedText[] = [];
    let embedded: PositionedText[] = [];

    for (const item of [...items].reverse()) {
        if (item.rtl) {
            logical.push(...embedded.reverse(), item);
            embedded = [];
            continue;
        }
        embedded.push(item);
    }

    logical.push(...embedded.reverse());
    return logical;
}

function joinTextSegments(rawItems: PositionedText[]): string {
    const items = toLogicalOrder(rawItems);
    let result = '';
    let previous: PositionedText | null = null;

    for (const item of items) {
        const currentText = normalizeInlineWhitespace(item.text);
        if (!currentText) continue;

        if (!previous) {
            result = currentText;
            previous = item;
            continue;
        }

        // Measured between the facing edges, so it holds whichever way the
        // line runs: in a right-to-left line the previous item sits to the right.
        const gap =
            item.x >= previous.x
                ? item.x - (previous.x + previous.width)
                : previous.x - (item.x + item.width);
        const avgCharWidth =
            previous.text.length > 0 ? Math.max(previous.width / previous.text.length, 1.5) : 4;

        if (gap > avgCharWidth * 5) {
            result += '\t' + currentText;
        } else if (gap > avgCharWidth * 0.6 && !result.endsWith('-')) {
            result += ' ' + currentText;
        } else {
            result += currentText;
        }

        previous = item;
    }

    return result.trim();
}

/** Maps unrotated PDF coordinates onto the page as the reader sees it. */
function toVisualPosition(x: number, y: number, geometry?: PageGeometry): { x: number; y: number } {
    switch (geometry ? ((geometry.rotate % 360) + 360) % 360 : 0) {
        case 90:
            return { x: y, y: geometry!.width - x };
        case 180:
            return { x: geometry!.width - x, y: geometry!.height - y };
        case 270:
            return { x: geometry!.height - y, y: x };
        default:
            return { x, y };
    }
}

/** Blank runs carry no direction and no typeface worth counting. */
function charactersWritten(items: PositionedText[]): number {
    return items.reduce((total, item) => total + item.text.trim().length, 0);
}

function dominantFont(items: PositionedText[]): string {
    const weights = new Map<string, number>();
    for (const item of items) {
        const written = item.text.trim().length;
        if (written === 0 || !item.font) continue;
        weights.set(item.font, (weights.get(item.font) ?? 0) + written);
    }

    let dominant = '';
    let best = 0;
    for (const [font, weight] of weights) {
        if (weight > best) {
            dominant = font;
            best = weight;
        }
    }
    return dominant;
}

export function groupPdfItemsIntoLines(
    items: PdfTextItem[],
    geometry?: PageGeometry,
): PositionedLine[] {
    const positioned: PositionedText[] = items
        .map((item) => {
            const transform = Array.isArray(item.transform) ? item.transform : [];
            const position = toVisualPosition(
                Number(transform[4] ?? 0),
                Number(transform[5] ?? 0),
                geometry,
            );
            return {
                text: item.str ?? '',
                x: position.x,
                y: position.y,
                width: Math.abs(Number(item.width ?? 0)),
                height: Math.abs(Number(item.height ?? transform[0] ?? 0)),
                hasEOL: Boolean(item.hasEOL),
                font: item.fontName ?? '',
                rtl: item.dir === 'rtl',
            };
        })
        .filter((item) => normalizeInlineWhitespace(item.text).length > 0)
        .sort((left, right) => {
            if (Math.abs(left.y - right.y) > 2) return right.y - left.y;
            return left.x - right.x;
        });

    const lines: PositionedLine[] = [];
    let currentItems: PositionedText[] = [];
    let currentY: number | null = null;
    let currentHeight = 0;

    const flush = () => {
        if (currentItems.length === 0 || currentY === null) return;
        currentItems.sort((left, right) => left.x - right.x);
        const text = joinTextSegments(currentItems);
        if (text) {
            const characters = charactersWritten(currentItems);
            const left = Math.min(...currentItems.map((item) => item.x));
            const right = Math.max(...currentItems.map((item) => item.x + item.width));
            lines.push({
                text,
                x: left,
                y: currentY,
                width: Math.max(right - left, 0),
                height: currentHeight,
                font: dominantFont(currentItems),
                rtl: charactersWritten(currentItems.filter((item) => item.rtl)) * 2 > characters,
            });
        }
        currentItems = [];
        currentY = null;
        currentHeight = 0;
    };

    for (const item of positioned) {
        if (currentY === null) {
            currentItems = [item];
            currentY = item.y;
            currentHeight = item.height;
            if (item.hasEOL) flush();
            continue;
        }

        const tolerance = Math.max(2, Math.min(6, Math.max(currentHeight, item.height) * 0.45));
        if (Math.abs(item.y - currentY) > tolerance) {
            flush();
            currentItems = [item];
            currentY = item.y;
            currentHeight = item.height;
            if (item.hasEOL) flush();
            continue;
        }

        const previous = currentItems[currentItems.length - 1];
        const previousEndX = previous ? previous.x + previous.width : item.x;
        const largeHorizontalGap = item.x - previousEndX;
        if (largeHorizontalGap > 120 && currentItems.length > 0) {
            flush();
            currentItems = [item];
            currentY = item.y;
            currentHeight = item.height;
            if (item.hasEOL) flush();
            continue;
        }

        currentItems.push(item);
        currentHeight = Math.max(currentHeight, item.height);
        currentY = (currentY + item.y) / 2;

        if (item.hasEOL) flush();
    }

    flush();
    return lines;
}

function getVerticalOverlap(left: PositionedLine[], right: PositionedLine[]): number {
    if (left.length === 0 || right.length === 0) return 0;

    const leftMinY = Math.min(...left.map((line) => line.y));
    const leftMaxY = Math.max(...left.map((line) => line.y));
    const rightMinY = Math.min(...right.map((line) => line.y));
    const rightMaxY = Math.max(...right.map((line) => line.y));

    return Math.min(leftMaxY, rightMaxY) - Math.max(leftMinY, rightMinY);
}

export function reorderPageLinesForReading(page: PositionedLine[]): string[] {
    const sorted = [...page].sort((left, right) => {
        if (Math.abs(left.y - right.y) > 2) return right.y - left.y;
        return left.x - right.x;
    });

    if (sorted.length < 8) {
        return sorted.map((line) => line.text);
    }

    const xs = sorted.map((line) => line.x).sort((a, b) => a - b);
    let biggestGap = 0;
    let splitPoint = 0;

    for (let index = 1; index < xs.length; index += 1) {
        const gap = xs[index] - xs[index - 1];
        if (gap > biggestGap) {
            biggestGap = gap;
            splitPoint = xs[index - 1] + gap / 2;
        }
    }

    if (biggestGap < 100) {
        return sorted.map((line) => line.text);
    }

    const leftColumn = sorted.filter((line) => line.x < splitPoint);
    const rightColumn = sorted.filter((line) => line.x >= splitPoint);
    if (leftColumn.length < 4 || rightColumn.length < 4) {
        return sorted.map((line) => line.text);
    }

    if (getVerticalOverlap(leftColumn, rightColumn) < 100) {
        return sorted.map((line) => line.text);
    }

    const byReadingOrder = (lines: PositionedLine[]) =>
        [...lines].sort((left, right) => {
            if (Math.abs(left.y - right.y) > 2) return right.y - left.y;
            return left.x - right.x;
        });

    return [...byReadingOrder(leftColumn), ...byReadingOrder(rightColumn)].map((line) => line.text);
}

export function detectRepeatedMarginLines(pages: PositionedLine[][]): Set<string> {
    const counts = new Map<string, number>();

    for (const page of pages) {
        const visible = page
            .map((line) => normalizeInlineWhitespace(line.text))
            .filter((line) => line && !isStandalonePageNumber(line));
        const marginCandidates = new Set([...visible.slice(0, 2), ...visible.slice(-2)]);

        for (const candidate of marginCandidates) {
            if (!candidate || candidate.length > 120) continue;
            const normalized = normalizeMarginCandidate(candidate);
            if (!normalized) continue;
            counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
        }
    }

    return new Set(
        [...counts.entries()].filter(([, count]) => count >= 4).map(([candidate]) => candidate),
    );
}

function detectPageMode(lines: string[]): PageMode {
    const visibleLines = lines
        .map((line) => normalizeInlineWhitespace(line))
        .filter((line) => line && !isStandalonePageNumber(line));

    if (visibleLines.length < 6) {
        return 'prose';
    }

    const structuredCount = visibleLines.filter((line) => {
        const shortIndexedLine = line.length < 70 && /\p{Nd}+\s*$/u.test(line);
        return isTableLikeLine(line) || isLikelyTocLine(line) || shortIndexedLine;
    }).length;

    return structuredCount / visibleLines.length >= 0.25 ? 'structured' : 'prose';
}

function shouldStartNewParagraph(
    previousLine: string,
    nextLine: string,
    medianLength: number,
): boolean {
    if (!previousLine) return false;
    if (isTableLikeLine(previousLine) || isTableLikeLine(nextLine)) return true;
    if (isBulletLikeLine(nextLine) || isLikelyHeading(nextLine)) return true;
    if (isLikelyHeading(previousLine)) return true;

    if (
        startsWithQuote(nextLine) &&
        (endsWithTerminalPunctuation(previousLine) || /[-—]["'»”’)]*$/u.test(previousLine))
    ) {
        return true;
    }

    if (shouldPreferCjkParagraphBreak(previousLine, nextLine, medianLength)) {
        return true;
    }

    const previousLooksTerminal = endsWithTerminalPunctuation(previousLine);
    const nextLooksLikeSentenceStart = startsLikeSentence(nextLine);
    const previousWasShort = previousLine.length < Math.max(40, medianLength * 0.75);

    return (
        (previousLooksTerminal && nextLooksLikeSentenceStart && previousWasShort) ||
        (previousLooksTerminal && startsWithQuote(nextLine))
    );
}

function isSoftHyphenation(previousLine: string, nextLine: string): boolean {
    return /[\p{Ll}]{2,}-$/u.test(previousLine) && /^[\p{Ll}]/u.test(nextLine);
}

/** Reflows wrapped lines into one run of text, healing hyphenated word breaks. */
export function joinWrappedLines(lines: string[]): string {
    let result = '';

    for (const rawLine of lines) {
        const line = normalizeInlineWhitespace(rawLine);
        if (!line) continue;
        if (!result) {
            result = line;
            continue;
        }
        result = isSoftHyphenation(result, line) ? result.slice(0, -1) + line : `${result} ${line}`;
    }

    return normalizeInlineWhitespace(result);
}

export function buildParagraphsFromLines(lines: string[], pageMode: PageMode = 'prose'): string[] {
    const visibleLines = lines
        .map((line) => normalizeInlineWhitespace(line))
        .filter((line) => line && !isStandalonePageNumber(line));

    const medianLength = median(visibleLines.map((line) => line.length));
    const paragraphs: string[] = [];
    let current = '';
    let previousLine = '';

    const flush = () => {
        const value = normalizeInlineWhitespace(current);
        if (value.length > 2) {
            paragraphs.push(value);
        }
        current = '';
        previousLine = '';
    };

    for (const rawLine of lines) {
        const line = normalizeInlineWhitespace(rawLine);

        if (!line || isStandalonePageNumber(line)) {
            flush();
            continue;
        }

        if (!current) {
            current = line;
            previousLine = line;
            continue;
        }

        if (
            pageMode === 'structured' ||
            isBulletLikeLine(line) ||
            isLikelyHeading(line) ||
            isTableLikeLine(line) ||
            isLikelyTocLine(line)
        ) {
            flush();
            current = line;
            previousLine = line;
            continue;
        }

        if (isBulletLikeLine(previousLine)) {
            flush();
            current = line;
            previousLine = line;
            continue;
        }

        if (shouldStartNewParagraph(previousLine, line, medianLength)) {
            flush();
            current = line;
            previousLine = line;
            continue;
        }

        current = isSoftHyphenation(current, line)
            ? current.slice(0, -1) + line
            : `${current} ${line}`;
        previousLine = line;
    }

    flush();
    return paragraphs;
}

export function serializeParagraphs(paragraphs: string[]): string {
    return paragraphs.join('\n');
}

export type PdfPageLayout = PageGeometry & {
    index: number;
    lines: PositionedLine[];
};

/** One entry of the PDF's own bookmark tree, resolved to a page. */
export type PdfOutlineEntry = {
    title: string;
    /** 1-based page index, as `PdfPageLayout.index`. */
    page: number;
    /** 1 for a top-level bookmark, deeper for its children. */
    level: number;
};

export type PdfDocumentContent = {
    layouts: PdfPageLayout[];
    outline: PdfOutlineEntry[];
};

/**
 * Single entry point for positional PDF text so callers that need layout
 * (book structure) and callers that need prose share one traversal.
 */
export async function extractPdfDocument(pdfBytes: Uint8Array): Promise<PdfDocumentContent> {
    if (pdfBytes.byteLength > MAX_PDF_SIZE_BYTES) {
        throw new Error('Le fichier est trop volumineux.');
    }

    const pdf = await getDocumentProxy(new Uint8Array(pdfBytes));

    try {
        const layouts: PdfPageLayout[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const view = page.view as number[];
            const geometry: PageGeometry = {
                width: Math.abs(Number(view?.[2] ?? 0) - Number(view?.[0] ?? 0)),
                height: Math.abs(Number(view?.[3] ?? 0) - Number(view?.[1] ?? 0)),
                rotate: Number((page as { rotate?: number }).rotate ?? 0),
            };
            const content = await page.getTextContent();
            layouts.push({
                index: pageNumber,
                ...geometry,
                lines: groupPdfItemsIntoLines(content.items as PdfTextItem[], geometry),
            });
            page.cleanup();
        }
        return { layouts, outline: await readPdfOutline(pdf as OutlineSource) };
    } finally {
        // Not every release of the PDF.js wrapper exposes destroy().
        await (pdf as { destroy?: () => Promise<void> }).destroy?.();
    }
}

export async function extractPdfPageLayouts(pdfBytes: Uint8Array): Promise<PdfPageLayout[]> {
    return (await extractPdfDocument(pdfBytes)).layouts;
}

type OutlineNode = { title?: string; dest?: unknown; items?: OutlineNode[] };
type OutlineSource = {
    getOutline?: () => Promise<OutlineNode[] | null>;
    getDestination?: (name: string) => Promise<unknown[] | null>;
    getPageIndex?: (ref: never) => Promise<number>;
};

/**
 * The bookmark tree a typesetter writes into the file. It names the chapters in
 * the original script, and survives the broken font encodings that make the
 * printed titles unreadable — so where it exists it is better evidence than
 * anything recoverable from the page.
 */
async function readPdfOutline(pdf: OutlineSource): Promise<PdfOutlineEntry[]> {
    const roots = await pdf.getOutline?.().catch(() => null);
    if (!roots || roots.length === 0) return [];

    const entries: PdfOutlineEntry[] = [];
    const walk = async (nodes: OutlineNode[], level: number): Promise<void> => {
        for (const node of nodes) {
            const page = await resolveOutlinePage(pdf, node.dest);
            const title = normalizeInlineWhitespace(node.title ?? '');
            if (page !== null && title) entries.push({ title, page, level });
            if (node.items?.length) await walk(node.items, level + 1);
        }
    };

    await walk(roots, 1);
    return entries;
}

async function resolveOutlinePage(pdf: OutlineSource, dest: unknown): Promise<number | null> {
    try {
        const explicit = typeof dest === 'string' ? await pdf.getDestination?.(dest) : dest;
        const target = Array.isArray(explicit) ? explicit[0] : null;
        if (target === null || target === undefined) return null;
        if (typeof target === 'number') return target + 1;
        return ((await pdf.getPageIndex?.(target as never)) ?? -1) + 1 || null;
    } catch {
        return null;
    }
}

export async function extractPdfParagraphs(pdfBytes: Uint8Array): Promise<string[]> {
    return buildParagraphsFromPageLayouts(await extractPdfPageLayouts(pdfBytes));
}

export function buildParagraphsFromPageLayouts(layouts: PdfPageLayout[]): string[] {
    const pageLines = layouts.map((layout) => layout.lines);

    const repeatedMargins = detectRepeatedMarginLines(pageLines);
    return pageLines.flatMap((page) => {
        const lines = reorderPageLinesForReading(page)
            .map((line) => normalizeInlineWhitespace(line))
            .filter((line) => {
                const normalized = normalizeMarginCandidate(line);
                return normalized ? !repeatedMargins.has(normalized) : false;
            });

        return buildParagraphsFromLines(lines, detectPageMode(lines));
    });
}

export async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
    return serializeParagraphs(await extractPdfParagraphs(pdfBytes));
}
