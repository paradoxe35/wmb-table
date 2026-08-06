import {
    isStandalonePageNumber,
    normalizeInlineWhitespace,
    normalizeMarginCandidate,
    type PdfPageLayout,
    type PositionedLine,
} from '../pdf-extract.service';
import { measureDocumentTypography, type DocumentTypography } from './page-blocks';

/**
 * Running heads and folios sit at the outermost baseline of the page, set off
 * from the text block, and repeat their wording. Requiring both keeps body text
 * from ever being taken for marginalia.
 */

/** Lines this close to the outermost baseline belong to the same head. */
const EDGE_TOLERANCE_EM = 0.5;
const MIN_EDGE_TOLERANCE = 3;
const MIN_DETACHMENT_RATIO = 1.4;
const MIN_BAND_COVERAGE = 0.2;
/** Low: a recto head often carries the chapter title, so it repeats only within it. */
const MIN_TEMPLATE_PAGES = 4;

/** Below this a "page number" sequence is more likely a coincidence than a folio. */
const MIN_SEQUENCE_PAGES = 5;
const MIN_SEQUENCE_DENSITY = 0.25;

const MAX_BAND_SPAN_RATIO = 0.6;
const MIN_BAND_DENSITY = 0.3;
const BAND_MERGE_DISTANCE = 2;

export interface PageMarginalia {
    /** Lines to strip before paragraph building. */
    lines: PositionedLine[];
    printed?: string;
}

/** A head confined to one stretch of the book carries that chapter's title. */
export interface RunningHeaderBand {
    startPage: number;
    label: string;
}

export interface MarginaliaAnalysis {
    byPage: Map<number, PageMarginalia>;
    /** Share of non-empty pages carrying a repeated header or footer. */
    runningCoverage: number;
    /** Share of non-empty pages whose printed number was recovered. */
    printedCoverage: number;
    firstPrintedPage: number | null;
    chapterBands: RunningHeaderBand[];
}

interface FolioEntry {
    pageIndex: number;
    label: string;
    value: number;
}

interface FolioRun {
    offset: number;
    from: number;
    to: number;
    entries: FolioEntry[];
}

interface BandLine {
    pageIndex: number;
    line: PositionedLine;
    template: string;
}

export function analysePageMarginalia(
    layouts: PdfPageLayout[],
    typography: DocumentTypography = measureDocumentTypography(layouts),
): MarginaliaAnalysis {
    const populated = layouts.filter((layout) => layout.lines.length > 0);
    const empty: MarginaliaAnalysis = {
        byPage: new Map(),
        runningCoverage: 0,
        printedCoverage: 0,
        firstPrintedPage: null,
        chapterBands: [],
    };
    if (populated.length === 0) return empty;

    const tolerance = Math.max(MIN_EDGE_TOLERANCE, typography.em * EDGE_TOLERANCE_EM);
    const detachment = typography.leading * MIN_DETACHMENT_RATIO;
    const bandLines = [
        ...collectBandLines(populated, 'top', tolerance, detachment),
        ...collectBandLines(populated, 'bottom', tolerance, detachment),
    ];
    const pagesByTemplate = groupPagesByTemplate(bandLines);
    const repeated = repeatedTemplates(pagesByTemplate);

    const marginalia = bandLines.filter(
        (candidate) =>
            repeated.has(candidate.template) || isStandalonePageNumber(candidate.line.text),
    );

    const byPage = new Map<number, PageMarginalia>();
    for (const candidate of marginalia) {
        const entry = byPage.get(candidate.pageIndex) ?? { lines: [] };
        entry.lines.push(candidate.line);
        byPage.set(candidate.pageIndex, entry);
    }

    const printed = resolvePrintedPageNumbers(marginalia);
    for (const [pageIndex, label] of printed) {
        const entry = byPage.get(pageIndex);
        if (entry) entry.printed = label;
    }

    const firstPrintedPage = printed.size > 0 ? Math.min(...printed.keys()) : null;

    return {
        byPage,
        runningCoverage: byPage.size / populated.length,
        printedCoverage: printed.size / populated.length,
        firstPrintedPage,
        chapterBands: findChapterBands(marginalia, pagesByTemplate, repeated, layouts.length),
    };
}

/**
 * A typeset book puts its head on the same baseline every page; a scan is never
 * registered that precisely, but the head is still detached from the text block.
 * Both tests are applied so neither kind of file is missed.
 */
function collectBandLines(
    layouts: PdfPageLayout[],
    edge: 'top' | 'bottom',
    tolerance: number,
    detachment: number,
): BandLine[] {
    const outermost = (lines: PositionedLine[]): number =>
        edge === 'top'
            ? Math.max(...lines.map((line) => line.y))
            : Math.min(...lines.map((line) => line.y));

    const band = densestBand(
        layouts.map((layout) => outermost(layout.lines)),
        tolerance,
    );
    const bandY = band && band.count / layouts.length >= MIN_BAND_COVERAGE ? band.value : null;

    return layouts.flatMap((layout) => {
        const edgeY = outermost(layout.lines);
        const head = layout.lines.filter((line) => Math.abs(line.y - edgeY) <= tolerance);
        const rest = layout.lines.filter((line) => Math.abs(line.y - edgeY) > tolerance);
        const detached = rest.length > 0 && Math.abs(edgeY - outermost(rest)) >= detachment;

        const found = detached ? [...head] : [];
        if (bandY !== null) {
            for (const line of layout.lines) {
                if (Math.abs(line.y - bandY) <= tolerance && !found.includes(line)) {
                    found.push(line);
                }
            }
        }

        return found.map((line) => ({
            pageIndex: layout.index,
            line,
            template: normalizeMarginCandidate(line.text),
        }));
    });
}

/** The baseline the most pages agree on, to within a tolerance a scan can meet. */
function densestBand(values: number[], tolerance: number): { value: number; count: number } | null {
    if (values.length === 0) return null;

    const sorted = [...values].sort((left, right) => left - right);
    let best = { value: sorted[0], count: 0 };
    let from = 0;

    for (let to = 0; to < sorted.length; to += 1) {
        while (sorted[to] - sorted[from] > tolerance * 2) from += 1;
        if (to - from + 1 > best.count) {
            best = { value: (sorted[from] + sorted[to]) / 2, count: to - from + 1 };
        }
    }

    return best;
}

function groupPagesByTemplate(bandLines: BandLine[]): Map<string, Set<number>> {
    const pagesByTemplate = new Map<string, Set<number>>();
    for (const candidate of bandLines) {
        if (!candidate.template) continue;
        const pages = pagesByTemplate.get(candidate.template) ?? new Set<number>();
        pages.add(candidate.pageIndex);
        pagesByTemplate.set(candidate.template, pages);
    }
    return pagesByTemplate;
}

function repeatedTemplates(pagesByTemplate: Map<string, Set<number>>): Set<string> {
    return new Set(
        [...pagesByTemplate.entries()]
            .filter(([, pages]) => pages.size >= MIN_TEMPLATE_PAGES)
            .map(([template]) => template),
    );
}

/** Keeps the chapter-title heads and drops the book-wide one, which spans everything. */
function findChapterBands(
    marginalia: BandLine[],
    pagesByTemplate: Map<string, Set<number>>,
    repeated: Set<string>,
    pageCount: number,
): RunningHeaderBand[] {
    const starts: RunningHeaderBand[] = [];

    for (const template of repeated) {
        const pages = [...(pagesByTemplate.get(template) ?? [])].sort((a, b) => a - b);
        const span = pages[pages.length - 1] - pages[0] + 1;
        if (span > pageCount * MAX_BAND_SPAN_RATIO) continue;
        if (pages.length / span < MIN_BAND_DENSITY) continue;

        const first = marginalia.find(
            (candidate) => candidate.template === template && candidate.pageIndex === pages[0],
        );
        starts.push({
            startPage: pages[0],
            label: normalizeInlineWhitespace(first?.line.text ?? '')
                .replace(/\p{Nd}+/gu, '')
                .trim(),
        });
    }

    starts.sort((left, right) => left.startPage - right.startPage);

    // Header and footer bands of the same chapter can start a page apart.
    return starts.filter(
        (band, position) =>
            position === 0 || band.startPage - starts[position - 1].startPage > BAND_MERGE_DISTANCE,
    );
}

/**
 * A head may hold several numbers ("… P7 REV #: 7"), only one of them the folio.
 * Each (template, position) pair competes, and only one whose values track the
 * page sequence at a constant offset survives.
 */
function resolvePrintedPageNumbers(marginalia: BandLine[]): Map<number, string> {
    const sequences = new Map<string, FolioEntry[]>();

    for (const candidate of marginalia) {
        const numbers = [...normalizeInlineWhitespace(candidate.line.text).matchAll(/\p{Nd}+/gu)];
        numbers.forEach((match, position) => {
            const value = parseDigits(match[0]);
            if (value === null) return;
            // NUL cannot occur in a normalized template, so it separates the two
            // parts of the key without ever merging two distinct hypotheses.
            const key = `${candidate.template}\u0000${position}`;
            const entries = sequences.get(key) ?? [];
            entries.push({ pageIndex: candidate.pageIndex, label: match[0], value });
            sequences.set(key, entries);
        });
    }

    const runs = mergeByOffset([...sequences.values()].flatMap(folioRuns));
    const printed = new Map<number, string>();
    for (const run of runs) {
        for (const entry of run.entries) {
            if (!printed.has(entry.pageIndex)) printed.set(entry.pageIndex, entry.label);
        }
    }

    return fillWithinRuns(printed, runs, marginalia);
}

/**
 * Every offset the numbers settle on, not just the commonest: folios restart when
 * roman front matter gives way to arabic, or two volumes are bound as one file.
 * A run counts only if it covers much of the stretch it spans.
 */
function folioRuns(entries: FolioEntry[]): FolioRun[] {
    const byOffset = new Map<number, FolioEntry[]>();
    for (const entry of entries) {
        const offset = entry.value - entry.pageIndex;
        byOffset.set(offset, [...(byOffset.get(offset) ?? []), entry]);
    }

    const runs: FolioRun[] = [];
    for (const [offset, run] of byOffset) {
        if (run.length < MIN_SEQUENCE_PAGES) continue;
        const pages = run.map((entry) => entry.pageIndex);
        const from = Math.min(...pages);
        const to = Math.max(...pages);
        if (run.length / (to - from + 1) < MIN_SEQUENCE_DENSITY) continue;
        runs.push({ offset, from, to, entries: run });
    }

    return runs;
}

/** Chapter-titled heads give one short run per chapter; merged, they span the book. */
function mergeByOffset(runs: FolioRun[]): FolioRun[] {
    const merged = new Map<number, FolioRun>();
    for (const run of runs) {
        const found = merged.get(run.offset);
        merged.set(
            run.offset,
            found
                ? {
                      offset: run.offset,
                      from: Math.min(found.from, run.from),
                      to: Math.max(found.to, run.to),
                      entries: [...found.entries, ...run.entries],
                  }
                : run,
        );
    }
    return [...merged.values()];
}

/** Inside an established run, a number landing where the run predicts is a folio too. */
function fillWithinRuns(
    printed: Map<number, string>,
    runs: FolioRun[],
    marginalia: BandLine[],
): Map<number, string> {
    const filled = new Map(printed);

    for (const candidate of marginalia) {
        if (filled.has(candidate.pageIndex)) continue;
        const covering = runs.filter(
            (run) => candidate.pageIndex >= run.from && candidate.pageIndex <= run.to,
        );
        const matches = [
            ...normalizeInlineWhitespace(candidate.line.text).matchAll(/\p{Nd}+/gu),
        ].filter((match) =>
            covering.some((run) => parseDigits(match[0]) === candidate.pageIndex + run.offset),
        );
        if (matches.length === 1) filled.set(candidate.pageIndex, matches[0][0]);
    }

    return filled;
}

/**
 * Reads a digit run in any script: Unicode decimal-digit blocks are contiguous
 * runs of ten, so a digit's value is its distance from the start of its block.
 */
export function parseDigits(digits: string): number | null {
    let value = 0;
    for (const character of digits) {
        const digit = digitValue(character);
        if (digit === null) return null;
        value = value * 10 + digit;
        if (!Number.isSafeInteger(value)) return null;
    }
    return value;
}

function digitValue(character: string): number | null {
    if (!/\p{Nd}/u.test(character)) return null;

    const codePoint = character.codePointAt(0)!;
    for (let offset = 1; offset <= 9; offset += 1) {
        if (!/\p{Nd}/u.test(String.fromCodePoint(codePoint - offset))) return offset - 1;
    }
    return 9;
}
