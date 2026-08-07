import {
    isStandalonePageNumber,
    median,
    type PdfPageLayout,
    type PositionedLine,
} from '../pdf-extract.service';

/**
 * Turns one page's lines into paragraph and heading blocks, from geometry alone.
 *
 * A paragraph is marked either by a first-line indent or by extra space between
 * blocks; books use one convention or the other, and both are read off the
 * coordinates rather than the words.
 *
 * Headings are scored, not matched: every single signal — centred, larger,
 * bolder, spaced, short — also describes something that is not a heading, so
 * they are combined against the document's own body text as the baseline.
 */

/** Fraction of an em below which two line starts count as the same column. */
const COLUMN_TOLERANCE_EM = 0.35;
const MIN_INDENT_EM = 0.4;
const MAX_INDENT_EM = 4;

/** A heading must be this much narrower than the text column. */
const MAX_HEADING_WIDTH_RATIO = 0.55;
/** Once a heading is open its remaining lines may run wider — titles wrap. */
const MAX_HEADING_CONTINUATION_WIDTH_RATIO = 0.8;
const CENTRE_TOLERANCE_RATIO = 0.05;

/** A title is never set smaller than the text it heads; ruby and footnotes are. */
const MIN_HEADING_SIZE_RATIO = 0.95;
/** Where size starts being evidence, and where it decides on its own. */
const HEADING_SIZE_FLOOR = 1.12;
const HEADING_SIZE_CEILING = 1.4;

const HEADING_SCORE_THRESHOLD = 1;
const HEADING_WEIGHT = {
    distinctFont: 0.35,
    spaceAbove: 0.35,
    spaceBelow: 0.2,
    short: 0.3,
    centred: 0.55,
} as const;

/** Multiple of the document's leading that counts as deliberate white space. */
const HEADING_SPACE_RATIO = 1.5;
const PARAGRAPH_SPACE_RATIO = 1.45;

/** Below this many lines a page's spacing is too sparse to read anything from. */
const MIN_SPACING_SAMPLE = 6;

const COLUMN_WIDTH_QUANTILE = 0.95;

/** Share of the lines at body size a font must carry to count as a body font. */
const MIN_BODY_FONT_SHARE = 0.15;

/** A gutter narrower than this is the ragged edge of a paragraph, not a column break. */
const MIN_GUTTER_EM = 2.5;
const MAX_GUTTER_OVERLAP_RATIO = 0.1;
const COLUMN_SEARCH_MARGIN = 0.2;

const DEFAULT_LEADING_EM = 1.2;

export type BlockRole = 'paragraph' | 'continuation' | 'heading';

export interface PageBlock {
    role: BlockRole;
    lines: PositionedLine[];
}

export interface PageStructure {
    blocks: PageBlock[];
    columns: number;
    /** True when the page exposes both a text column and an indent column. */
    indented: boolean;
    /** True when the page separates its paragraphs by extra vertical space. */
    blockSpaced: boolean;
}

/** Measured once per document, so every threshold above is dimensionless. */
export interface DocumentTypography {
    /** Modal line height: the em everything else is expressed in. */
    em: number;
    /** Modal baseline-to-baseline distance between consecutive lines. */
    leading: number;
    /** Fonts carrying the body text. Empty when the source reports none. */
    bodyFonts: Set<string>;
    /** The document is written right to left. */
    rtl: boolean;
}

/** Only the geometry the analysis uses, so a mirrored copy fits the same helpers. */
interface Placed {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface PlacedLine extends Placed {
    source: PositionedLine;
    font: string;
    /** Baseline distance to the line above; infinite at the top of the page. */
    spaceAbove: number;
    spaceBelow: number;
}

export function measureTypography(pages: PositionedLine[][]): DocumentTypography {
    const lines = pages.flat();
    const em = modalValue(lines.map((line) => line.height)) ?? median(lines.map((l) => l.height));

    const gaps: number[] = [];
    for (const page of pages) {
        const ordered = [...page].sort((left, right) => right.y - left.y);
        for (let position = 1; position < ordered.length; position += 1) {
            const gap = ordered[position - 1].y - ordered[position].y;
            if (gap > 0) gaps.push(gap);
        }
    }

    const rtl = lines.filter((line) => line.rtl).length * 2 > lines.length;

    return {
        em: Math.max(em, 1),
        leading: Math.max(modalValue(gaps) ?? em * DEFAULT_LEADING_EM, 1),
        bodyFonts: bodyFonts(lines, em),
        rtl,
    };
}

export function measureDocumentTypography(layouts: PdfPageLayout[]): DocumentTypography {
    return measureTypography(layouts.map((layout) => layout.lines));
}

export function analysePageStructure(
    layout: PdfPageLayout,
    lines: PositionedLine[],
    typography: DocumentTypography = measureTypography([lines]),
): PageStructure {
    const gutters = findGutters(layout, lines, typography.em);
    const columns = gutters.length + 1;
    const empty: PageStructure = { blocks: [], columns, indented: false, blockSpaced: false };
    if (lines.length === 0) return empty;

    // An indent means nothing across a column break, so each column is segmented
    // on its own — but the words still have to reach the reader.
    if (gutters.length > 0) {
        const parts = splitAtGutters(lines, gutters);
        if (parts.every((part) => part.length < lines.length)) {
            return {
                blocks: parts.flatMap(
                    (part) => analysePageStructure(layout, part, typography).blocks,
                ),
                columns,
                indented: false,
                blockSpaced: false,
            };
        }
        return empty;
    }

    const placed = place(lines, typography.rtl ? pageVisualWidth(layout) : null);
    const em = typography.em;
    const tolerance = em * COLUMN_TOLERANCE_EM;

    const textLeft = leftmostColumn(placed, tolerance);
    const columnWidth = columnMeasure(placed.map((line) => line.width));
    const body = withoutSideMarginalia(placed, textLeft, columnWidth);
    if (body.length === 0) return empty;

    const indentLeft = indentColumn(body, textLeft, em, tolerance);
    const blockSpaced = indentLeft === null && hasBlockSpacing(body, typography.leading);
    const heading = {
        em,
        leading: typography.leading,
        bodyFonts: typography.bodyFonts,
        textLeft,
        tolerance,
        columnWidth,
        columnCentre: textLeft + columnWidth / 2,
    };

    const blocks: PageBlock[] = [];
    // Blocks hold source lines, but geometry is compared in the mirrored space.
    const tails: PlacedLine[] = [];

    for (const line of body) {
        const role = classify(line, {
            open: blocks[blocks.length - 1]?.role ?? null,
            tail: tails[tails.length - 1] ?? null,
            heading,
            indentLeft,
            blockSpaced,
            paragraphSpace: typography.leading * PARAGRAPH_SPACE_RATIO,
            quotationLeft: textLeft + em * MAX_INDENT_EM,
        });

        if (role === 'append') {
            blocks[blocks.length - 1].lines.push(line.source);
            tails[tails.length - 1] = line;
            continue;
        }
        blocks.push({ role, lines: [line.source] });
        tails.push(line);
    }

    return { blocks, columns, indented: indentLeft !== null, blockSpaced };
}

/** A line belongs to the column its own start position falls in. */
function splitAtGutters(lines: PositionedLine[], gutters: number[]): PositionedLine[][] {
    const bounds = [...gutters].sort((left, right) => left - right);
    const parts: PositionedLine[][] = Array.from({ length: bounds.length + 1 }, () => []);

    for (const line of lines) {
        const column = bounds.findIndex((gutter) => line.x < gutter);
        parts[column === -1 ? bounds.length : column].push(line);
    }

    return parts.filter((part) => part.length > 0);
}

interface BlockContext {
    /** Role of the block still open, or null on the first line of the page. */
    open: BlockRole | null;
    tail: PlacedLine | null;
    heading: HeadingContext;
    indentLeft: number | null;
    blockSpaced: boolean;
    paragraphSpace: number;
    quotationLeft: number;
}

function classify(line: PlacedLine, context: BlockContext): BlockRole | 'append' {
    const isHeading = isHeadingLine(line, context.heading, context.blockSpaced);

    if (context.open === 'heading') {
        // Titles wrap, and a chapter number sits on its own line above its title.
        return isHeading || continuesHeading(line, context.heading) ? 'append' : 'paragraph';
    }
    if (isHeading) return 'heading';

    if (
        context.indentLeft !== null &&
        Math.abs(line.x - context.indentLeft) <= context.heading.tolerance
    ) {
        return 'paragraph';
    }

    // Where paragraphs are separated by space rather than by an indent, the space
    // is the only thing that marks the opening line.
    // At the top of a page there is no gap to read, so the previous page's
    // paragraph stays open.
    if (
        context.blockSpaced &&
        Number.isFinite(line.spaceAbove) &&
        line.spaceAbove > context.paragraphSpace
    ) {
        return 'paragraph';
    }

    // Anything starting well right of the text column is a quotation or verse
    // block: it opens a paragraph, and its own wrapped lines continue it.
    if (line.x > context.quotationLeft) {
        const sameColumn =
            context.tail !== null && Math.abs(context.tail.x - line.x) <= context.heading.tolerance;
        return context.open !== null && sameColumn ? 'append' : 'paragraph';
    }

    return context.open === null ? 'continuation' : 'append';
}

/** Mirrors a right-to-left page, so everything downstream reads one direction. */
function place(lines: PositionedLine[], mirrorWidth: number | null): PlacedLine[] {
    const ordered = [...lines].sort((left, right) => right.y - left.y);

    return ordered.map((line, position) => ({
        source: line,
        x: mirrorWidth === null ? line.x : mirrorWidth - line.x - line.width,
        y: line.y,
        width: line.width,
        height: line.height,
        font: line.font ?? '',
        spaceAbove: position === 0 ? Number.POSITIVE_INFINITY : ordered[position - 1].y - line.y,
        spaceBelow:
            position === ordered.length - 1
                ? Number.POSITIVE_INFINITY
                : line.y - ordered[position + 1].y,
    }));
}

/**
 * Verse numbers printed in the outer margin would otherwise open a paragraph and
 * swallow the lines below it, corrupting the text and making the document look
 * like a numbered transcript.
 */
function withoutSideMarginalia(
    lines: PlacedLine[],
    textLeft: number,
    columnWidth: number,
): PlacedLine[] {
    if (lines.length < MIN_SPACING_SAMPLE) return lines;

    const kept = lines.filter(
        (line) =>
            line.x < textLeft + columnWidth || !isStandalonePageNumber(line.source.text.trim()),
    );
    return kept.length === lines.length ? lines : reflow(kept);
}

/** Neighbours change when lines are removed, so the spacing is retaken. */
function reflow(lines: PlacedLine[]): PlacedLine[] {
    return lines.map((line, position) => ({
        ...line,
        spaceAbove: position === 0 ? Number.POSITIVE_INFINITY : lines[position - 1].y - line.y,
        spaceBelow:
            position === lines.length - 1
                ? Number.POSITIVE_INFINITY
                : line.y - lines[position + 1].y,
    }));
}

interface HeadingContext {
    em: number;
    leading: number;
    bodyFonts: Set<string>;
    textLeft: number;
    tolerance: number;
    columnWidth: number;
    columnCentre: number;
}

function isHeadingLine(line: PlacedLine, context: HeadingContext, blockSpaced: boolean): boolean {
    const relative = line.height / context.em;
    if (relative < MIN_HEADING_SIZE_RATIO) return false;

    const size = ramp(relative, HEADING_SIZE_FLOOR, HEADING_SIZE_CEILING);
    const distinctFont =
        context.bodyFonts.size > 0 && line.font !== '' && !context.bodyFonts.has(line.font);
    const short = line.width <= context.columnWidth * MAX_HEADING_WIDTH_RATIO;
    const centred =
        line.x > context.textLeft + context.tolerance &&
        isCentred(line, context.columnCentre, context.columnWidth, MAX_HEADING_WIDTH_RATIO);

    // White space and shortness describe a paragraph's last line just as well.
    // Without a typographic difference there is nothing to tell them apart.
    if (size === 0 && !distinctFont && !centred) return false;

    const spaced = blockSpaced ? HEADING_SPACE_RATIO * 2 : HEADING_SPACE_RATIO;
    const score =
        size +
        (distinctFont ? HEADING_WEIGHT.distinctFont : 0) +
        (line.spaceAbove > context.leading * spaced ? HEADING_WEIGHT.spaceAbove : 0) +
        (line.spaceBelow > context.leading * spaced ? HEADING_WEIGHT.spaceBelow : 0) +
        (short ? HEADING_WEIGHT.short : 0) +
        (centred ? HEADING_WEIGHT.centred : 0);

    return score >= HEADING_SCORE_THRESHOLD;
}

function continuesHeading(line: PlacedLine, context: HeadingContext): boolean {
    return (
        line.x > context.textLeft + context.tolerance &&
        isCentred(
            line,
            context.columnCentre,
            context.columnWidth,
            MAX_HEADING_CONTINUATION_WIDTH_RATIO,
        )
    );
}

/** 0 below `from`, 1 at or above `to`, linear in between. */
function ramp(value: number, from: number, to: number): number {
    return Math.max(0, Math.min(1, (value - from) / (to - from)));
}

function hasBlockSpacing(lines: PlacedLine[], leading: number): boolean {
    if (lines.length < MIN_SPACING_SAMPLE) return false;

    const gaps = lines
        .slice(1)
        .map((line) => line.spaceAbove)
        .filter((gap) => Number.isFinite(gap));
    const wide = gaps.filter((gap) => gap > leading * PARAGRAPH_SPACE_RATIO).length;

    // Every gap being wide means the leading estimate came from elsewhere in the
    // document, not that every line opens a paragraph.
    return wide > 0 && wide <= gaps.length / 2;
}

function isCentred(
    line: Placed,
    columnCentre: number,
    columnWidth: number,
    widthLimit: number,
): boolean {
    if (line.width > columnWidth * widthLimit) return false;
    const centre = line.x + line.width / 2;
    return Math.abs(centre - columnCentre) <= columnWidth * CENTRE_TOLERANCE_RATIO;
}

function pageVisualWidth(layout: PdfPageLayout): number {
    const rotation = ((layout.rotate % 360) + 360) % 360;
    return rotation === 90 || rotation === 270 ? layout.height : layout.width;
}

function leftmostColumn(lines: Placed[], tolerance: number): number {
    const clusters = clusterStarts(lines, tolerance);
    const support = Math.max(2, lines.length * 0.15);
    const columns = clusters.filter((cluster) => cluster.count >= support);
    return (columns.length > 0 ? columns : clusters)[0].position;
}

function indentColumn(
    lines: Placed[],
    textLeft: number,
    em: number,
    tolerance: number,
): number | null {
    const candidates = clusterStarts(lines, tolerance).filter((cluster) => {
        const offset = cluster.position - textLeft;
        return offset >= em * MIN_INDENT_EM && offset <= em * MAX_INDENT_EM;
    });
    return candidates.length > 0 ? candidates[0].position : null;
}

function clusterStarts(
    lines: Placed[],
    tolerance: number,
): Array<{ position: number; count: number }> {
    const clusters: Array<{ position: number; count: number }> = [];

    for (const x of lines.map((line) => line.x).sort((left, right) => left - right)) {
        const last = clusters[clusters.length - 1];
        if (last && x - last.position <= tolerance) {
            last.count += 1;
            continue;
        }
        clusters.push({ position: x, count: 1 });
    }

    return clusters;
}

/**
 * Near the top of the distribution rather than the maximum: one line that caught
 * a marginal number on its baseline would otherwise widen the column past the
 * margin and hide everything printed there.
 */
function columnMeasure(widths: number[]): number {
    const sorted = [...widths].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * COLUMN_WIDTH_QUANTILE))];
}

/**
 * Only the faces a real share of the body is set in. Taking every font at body
 * size would enrol the bold used for same-size headings, which is what finds them.
 */
function bodyFonts(lines: PositionedLine[], em: number): Set<string> {
    const counts = new Map<string, number>();
    let total = 0;
    for (const line of lines) {
        if (!line.font || Math.round(line.height * 2) !== Math.round(em * 2)) continue;
        counts.set(line.font, (counts.get(line.font) ?? 0) + 1);
        total += 1;
    }

    return new Set(
        [...counts.entries()]
            .filter(([, count]) => count >= total * MIN_BODY_FONT_SHARE)
            .map(([font]) => font),
    );
}

/** Most common value, to the nearest half point. Null when there is nothing to count. */
function modalValue(values: number[]): number | null {
    const counts = new Map<number, number>();
    for (const value of values) {
        const rounded = Math.round(value * 2) / 2;
        counts.set(rounded, (counts.get(rounded) ?? 0) + 1);
    }

    let best: number | null = null;
    let bestCount = 0;
    for (const [value, count] of counts) {
        if (count > bestCount) {
            best = value;
            bestCount = count;
        }
    }
    return best;
}

/**
 * The x positions of the page's vertical gutters: bands the text avoids, wide
 * enough to be a column break rather than the ragged edge of a paragraph.
 */
export function findGutters(
    layout: PdfPageLayout,
    lines: PositionedLine[],
    em = median(lines.map((line) => line.height)),
): number[] {
    const width = pageVisualWidth(layout);
    if (lines.length < 8 || width <= 0) return [];

    const buckets = 200;
    const covered = new Array<number>(buckets).fill(0);
    for (const line of lines) {
        const from = Math.max(0, Math.floor((line.x / width) * buckets));
        const to = Math.min(buckets - 1, Math.ceil(((line.x + line.width) / width) * buckets));
        for (let bucket = from; bucket <= to; bucket += 1) covered[bucket] += 1;
    }

    const searchFrom = Math.floor(buckets * COLUMN_SEARCH_MARGIN);
    const searchTo = Math.ceil(buckets * (1 - COLUMN_SEARCH_MARGIN));
    const minGutter = Math.max(2, Math.round((buckets * em * MIN_GUTTER_EM) / width));
    // A few lines are always misread as spanning the gutter, so a gutter is where
    // coverage collapses rather than where it reaches exactly zero.
    const clear = lines.length * MAX_GUTTER_OVERLAP_RATIO;

    const gutters: number[] = [];
    let run = 0;
    let text = false;
    for (let bucket = searchFrom; bucket <= searchTo; bucket += 1) {
        if (covered[bucket] > clear) {
            // A band with text on only one side is the page margin, not a gutter.
            if (text && run >= minGutter) gutters.push(((bucket - run / 2) / buckets) * width);
            run = 0;
            text = true;
            continue;
        }
        run += 1;
    }

    return gutters;
}

export function countColumns(
    layout: PdfPageLayout,
    lines: PositionedLine[],
    em = median(lines.map((line) => line.height)),
): number {
    return findGutters(layout, lines, em).length + 1;
}
