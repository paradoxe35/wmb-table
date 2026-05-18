import type { SearchMatchersValue, SearchMode } from './types';

// ---------------------------------------------------------------------------
// Core utilities
// ---------------------------------------------------------------------------

export function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function strNormalize(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase();
}

export function strNormalizeNoLower(str: string | null): string {
    return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
}

export function simpleRegExp(term: string): RegExp {
    return new RegExp(wordPattern(term), 'gi');
}

/** Split query like Tantivy's SimpleTokenizer. Drops single-char noise tokens for all/any. */
export function tokenizeQuery(query: string, mode: SearchMode = 'all'): string[] {
    const words = query
        .trim()
        .split(/[^a-zA-Z0-9\u00C0-\u024F]+/)
        .filter(Boolean);
    if (mode === 'exact') return words;
    return words.filter((w) => w.length > 1);
}

// ---------------------------------------------------------------------------
// Pattern builders
// ---------------------------------------------------------------------------

function wordPattern(word: string): string {
    return strNormalize(escapeRegExp(word))
        .replace(/['|']/g, "[''']")
        .replace(/(œ|oe)/g, '(œ|oe)');
}

function buildWordRegex(word: string): RegExp {
    return new RegExp('\\b' + wordPattern(word) + '\\b', 'gi');
}

/**
 * Build a phrase span regex: matches the entire span from first to last word.
 * Words must appear in order. Allows up to MAX_PHRASE_GAP chars between each pair.
 */
const MAX_PHRASE_GAP = 80;

function buildPhraseSpanRegex(words: string[]): RegExp | null {
    if (words.length === 0) return null;
    if (words.length === 1) return buildWordRegex(words[0]);
    const pattern = words
        .map((w) => '\\b' + wordPattern(w) + '\\b')
        .join(`[\\s\\S]{0,${MAX_PHRASE_GAP}}?`);
    return new RegExp(pattern, 'gi');
}

// ---------------------------------------------------------------------------
// Highlight ranges
// ---------------------------------------------------------------------------

interface HighlightMatch {
    start: number;
    end: number;
}

function findWordMatches(normalized: string, words: string[]): HighlightMatch[] {
    const positions: HighlightMatch[] = [];
    for (const w of words) {
        for (const m of normalized.matchAll(buildWordRegex(w))) {
            positions.push({ start: m.index!, end: m.index! + m[0].length });
        }
    }
    return positions.sort((a, b) => a.start - b.start);
}

/**
 * Get highlight positions for text.
 * - exact: phrase span first, falls back to individual words if no span found
 * - all/any: individual word occurrences
 *
 * The fallback ensures every matched paragraph has visible highlights
 * in both search results and document view.
 */
export function getHighlightRanges(
    text: string,
    query: string,
    mode: SearchMode,
): HighlightMatch[] {
    const words = tokenizeQuery(query, mode);
    if (words.length === 0) return [];

    const normalized = strNormalizeNoLower(text);

    if (mode === 'exact' && words.length > 1) {
        const regex = buildPhraseSpanRegex(words);
        if (regex) {
            const spans: HighlightMatch[] = [];
            for (const m of normalized.matchAll(regex)) {
                spans.push({ start: m.index!, end: m.index! + m[0].length });
            }
            if (spans.length > 0) return spans;
        }
        // Fallback: individual words so paragraph isn't blank
        return findWordMatches(
            normalized,
            words.filter((w) => w.length > 1),
        );
    }

    return findWordMatches(normalized, words);
}

/** True only when every tokenized query word appears (as a whole word) in the text. */
export function paragraphContainsAllWords(text: string, query: string, mode: SearchMode): boolean {
    const words = tokenizeQuery(query, mode);
    if (words.length === 0) return false;
    const normalized = strNormalizeNoLower(text);
    return words.every((w) => buildWordRegex(w).test(normalized));
}

/**
 * Extract a short text window centered on the first match.
 */
export function extractSnippetWindow(
    text: string,
    query: string,
    mode: SearchMode,
    maxChars: number = 250,
): { text: string; ranges: HighlightMatch[] } {
    if (text.length <= maxChars) {
        return { text, ranges: getHighlightRanges(text, query, mode) };
    }

    // Find first match to center on
    const allRanges = getHighlightRanges(text, query, mode);
    const center = allRanges.length > 0 ? allRanges[0].start : 0;

    // Build window
    let start = Math.max(0, center - 40);
    let end = Math.min(text.length, start + maxChars);

    if (start > 0) {
        const sp = text.indexOf(' ', start);
        if (sp !== -1 && sp < start + 20) start = sp + 1;
    }
    if (end < text.length) {
        const sp = text.lastIndexOf(' ', end);
        if (sp !== -1 && sp > end - 20) end = sp;
    }

    const prefix = start > 0 ? '...' : '';
    const suffix = end < text.length ? '...' : '';
    const windowText = prefix + text.slice(start, end) + suffix;
    const prefixLen = prefix.length;

    // Recompute highlights on the window text (not the full text)
    const windowContent = text.slice(start, end);
    const windowRanges = getHighlightRanges(windowContent, query, mode);
    const adjustedRanges = windowRanges.map((r) => ({
        start: r.start + prefixLen,
        end: r.end + prefixLen,
    }));

    return { text: windowText, ranges: adjustedRanges };
}

/** Regex for all/any modes and Ctrl+F. */
export function buildHighlightRegex(query: string, _mode: SearchMode, stem = true): RegExp | null {
    const words = tokenizeQuery(query, 'all');
    if (words.length === 0) return null;
    const patterns = stem
        ? words.map((w) => '\\b' + wordPattern(w) + '\\b')
        : words.map((w) => wordPattern(w));
    return new RegExp(patterns.join('|'), 'gi');
}

// ---------------------------------------------------------------------------
// Legacy helpers
// ---------------------------------------------------------------------------

export function toSearchableTerms(term: string): string {
    const terms = strNormalizeNoLower(escapeRegExp(term.trim()))
        .split(' ')
        .filter(Boolean)
        .join('[a-zA-Z]*([^s+]*)?');
    return `${terms}[a-zA-Z]*`;
}

export function regexpMatcher(pattern: string | RegExp, haystack: string): SearchMatchersValue[] {
    const regexp = new RegExp(
        typeof pattern === 'string'
            ? pattern.replace(/['|']/g, "[''']").replace(/(œ|oe)/g, '(œ|oe)')
            : pattern,
        'gi',
    );
    return [...haystack.matchAll(regexp)].map((match, i) => ({
        term: match[0],
        index: i + 1,
        start: match.index,
        end: match.index != null ? match.index + match[0].length : undefined,
    }));
}

export function performSearch(needle: string, haystack: string): SearchMatchersValue[] {
    return regexpMatcher(toSearchableTerms(needle), haystack);
}

export function matchesQuery(text: string, query: string, mode: SearchMode): boolean {
    const words = tokenizeQuery(query, mode);
    if (words.length === 0) return false;
    switch (mode) {
        case 'exact': {
            const regex = buildPhraseSpanRegex(words);
            return regex ? regex.test(strNormalizeNoLower(text)) : false;
        }
        case 'all':
            return words.every((w) => {
                const re = simpleRegExp(w);
                re.lastIndex = 0;
                return re.test(text);
            });
        case 'any':
            return words.some((w) => {
                const re = simpleRegExp(w);
                re.lastIndex = 0;
                return re.test(text);
            });
    }
}
