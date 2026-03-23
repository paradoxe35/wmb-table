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

/** Build an accent/ligature-aware regex for a single term. */
export function simpleRegExp(term: string): RegExp {
    return new RegExp(wordPattern(term), 'gi');
}

// ---------------------------------------------------------------------------
// Pattern builders
// ---------------------------------------------------------------------------

/** Normalize a single word into a regex-safe pattern with ligature/quote handling. */
function wordPattern(word: string): string {
    return strNormalize(escapeRegExp(word))
        .replace(/['|']/g, "[''']")
        .replace(/(œ|oe)/g, '(œ|oe)');
}

/**
 * Max character gap between phrase words.
 * Aligned with Tantivy's PHRASE_SLOP (25 words × ~10 chars/word = 250 chars).
 */
const PHRASE_CHAR_GAP = 250;

/** Phrase pattern: words in order, within PHRASE_CHAR_GAP chars, whole-word boundaries. */
function phrasePattern(query: string): string {
    const words = query.trim().split(/\s+/).filter(Boolean);
    return words.map((w) => '\\b' + wordPattern(w) + '\\b').join(`[\\s\\S]{0,${PHRASE_CHAR_GAP}}?`);
}


/**
 * Legacy: sequential terms with flexible gaps between words.
 * Note: uses [^s+] (not [^\s+]) to allow spaces — matches the original
 * template-literal behavior from the old codebase.
 */
export function toSearchableTerms(term: string): string {
    const terms = strNormalizeNoLower(escapeRegExp(term.trim()))
        .split(' ')
        .filter(Boolean)
        .join('[a-zA-Z]*([^s+]*)?');
    return `${terms}[a-zA-Z]*`;
}

// ---------------------------------------------------------------------------
// Regex matcher
// ---------------------------------------------------------------------------

export function regexpMatcher(pattern: string | RegExp, haystack: string): SearchMatchersValue[] {
    const regexp = new RegExp(
        typeof pattern === 'string'
            ? pattern.replace(/['|']/g, "[''']").replace(/(œ|oe)/g, '(œ|oe)')
            : pattern,
        'gi',
    );
    const matches = [...haystack.matchAll(regexp)];

    return matches.map((match, i) => ({
        term: match[0],
        index: i + 1,
        start: match.index,
        end: match.index != null ? match.index + match[0].length : undefined,
    }));
}

/** Legacy: exact phrase search using toSearchableTerms. */
export function performSearch(needle: string, haystack: string): SearchMatchersValue[] {
    const terms = toSearchableTerms(needle);
    return regexpMatcher(terms, haystack);
}

// ---------------------------------------------------------------------------
// Search mode API — single entry point for filtering & highlighting
// ---------------------------------------------------------------------------

/**
 * Test whether `text` matches `query` under the given search mode.
 * Text should already be normalized with strNormalizeNoLower.
 */
export function matchesQuery(text: string, query: string, mode: SearchMode): boolean {
    const words = query.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return false;

    switch (mode) {
        case 'exact': {
            const re = new RegExp(phrasePattern(query), 'gi');
            return re.test(text);
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

/**
 * Build a regex for highlighting matches in text.
 * Used by Ctrl+F inline search and as fallback when Tantivy highlights are unavailable.
 * @param stem — true: whole-word matching. false: substring matching (Ctrl+F).
 */
export function buildHighlightRegex(query: string, _mode: SearchMode, stem = true): RegExp | null {
    const words = query.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return null;

    const patterns = stem
        ? words.map((w) => '\\b' + wordPattern(w) + '\\b')
        : words.map((w) => wordPattern(w));
    return new RegExp(patterns.join('|'), 'gi');
}
