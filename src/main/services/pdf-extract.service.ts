import { getDocumentProxy } from 'unpdf';

/**
 * Extract readable paragraph text from a PDF using PDF.js text items.
 *
 * `unpdf.extractText()` flattens page text too early for custom import use cases.
 * Here we keep positional text items, rebuild lines, drop repeated headers/footers,
 * and then merge wrapped lines into paragraphs.
 */
const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

type PdfTextItem = {
    str?: string;
    hasEOL?: boolean;
    transform?: number[];
    width?: number;
    height?: number;
};

type PositionedText = {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    hasEOL: boolean;
};

type PositionedLine = {
    text: string;
    x: number;
    y: number;
    height: number;
};

type PageMode = 'prose' | 'structured';

function normalizeInlineWhitespace(text: string): string {
    return text
        .replace(/\u00a0/g, ' ')
        .split('\t')
        .map((segment) => segment.replace(/ {2,}/g, ' ').trim())
        .join('\t')
        .replace(/\t{2,}/g, '\t')
        .trim();
}

function normalizeMarginCandidate(text: string): string {
    return text
        .toLowerCase()
        .replace(/\d+/g, '#')
        .replace(/[^\p{L}\p{N}# ]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isTableLikeLine(text: string): boolean {
    return /\t/.test(text) || /\s{3,}/.test(text);
}

function isBulletLikeLine(text: string): boolean {
    return /^([-*•▪◦]|\d+[.)]|\p{L}[.)])\s+/u.test(text);
}

function isLikelyTocLine(text: string): boolean {
    return (
        /\t/.test(text) ||
        /\.{2,}\s*\d+\s*$/.test(text) ||
        /^(chapter|part|section|appendix)\b.+\d+\s*$/i.test(text) ||
        /^(?:\d+|[ivxlcdm]+)\b.+\d+\s*$/i.test(text)
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

function isStandalonePageNumber(text: string): boolean {
    return /^(page\s+)?\d+([/-]\d+)?$/i.test(text) || /^\d+\s+of\s+\d+$/i.test(text);
}

function countMatches(text: string, pattern: RegExp): number {
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
    return /^[\p{Lu}0-9«"'(“‘「『（《【\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
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

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function joinTextSegments(items: PositionedText[]): string {
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

        const previousEndX = previous.x + previous.width;
        const gap = item.x - previousEndX;
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

export function groupPdfItemsIntoLines(items: PdfTextItem[]): PositionedLine[] {
    const positioned: PositionedText[] = items
        .map((item) => {
            const transform = Array.isArray(item.transform) ? item.transform : [];
            return {
                text: item.str ?? '',
                x: Number(transform[4] ?? 0),
                y: Number(transform[5] ?? 0),
                width: Math.abs(Number(item.width ?? 0)),
                height: Math.abs(Number(item.height ?? transform[0] ?? 0)),
                hasEOL: Boolean(item.hasEOL),
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
            lines.push({
                text,
                x: currentItems[0]?.x ?? 0,
                y: currentY,
                height: currentHeight,
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
        const shortIndexedLine = line.length < 70 && /\d+\s*$/.test(line);
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

export async function extractPdfParagraphs(pdfBytes: Uint8Array): Promise<string[]> {
    if (pdfBytes.byteLength > MAX_PDF_SIZE_BYTES) {
        throw new Error('Le fichier est trop volumineux.');
    }

    const normalizedBytes = new Uint8Array(pdfBytes);
    const pdf = await getDocumentProxy(normalizedBytes);

    try {
        const pageLines: PositionedLine[][] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            pageLines.push(groupPdfItemsIntoLines(content.items as PdfTextItem[]));
        }

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
    } finally {
        await pdf.loadingTask?.destroy();
    }
}

export async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
    return serializeParagraphs(await extractPdfParagraphs(pdfBytes));
}
