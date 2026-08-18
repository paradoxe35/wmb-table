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

/**
 * Strips Latin, Greek and Cyrillic diacritics only. The Japanese voiced-sound
 * marks (U+3099\u2013U+309A) are left alone \u2014 removing those would turn \u3060 into \u305f.
 * Chinese has neither case nor combining marks, so it passes through untouched
 * and still matches by substring.
 */
function stripDiacritics(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function strNormalize(str: string): string {
    return stripDiacritics(str).toLocaleLowerCase();
}

export function strNormalizeNoLower(str: string | null): string {
    return str ? stripDiacritics(str) : '';
}

const APOSTROPHES = "'\u2019\u2018\u02bc";

/**
 * Every codepoint carrying a combining mark lives below U+2000: Latin-1 Supplement and the
 * Latin extensions, Greek and its polytonic block, Cyrillic, and Latin Extended Additional.
 */
const LAST_COMPOSED_CODEPOINT = 0x1fff;

let diacriticVariants: Map<string, string> | null = null;

/** Base character -> every codepoint stripDiacritics reduces to it, so both stay in step. */
function getDiacriticVariants(): Map<string, string> {
    if (diacriticVariants) return diacriticVariants;

    diacriticVariants = new Map();
    for (let code = 0x00c0; code <= LAST_COMPOSED_CODEPOINT; code++) {
        const char = String.fromCodePoint(code);
        const base = stripDiacritics(char);
        if (base === char || base.length !== 1) continue;
        diacriticVariants.set(base, (diacriticVariants.get(base) ?? base) + char);
    }

    return diacriticVariants;
}

function characterClass(char: string): string {
    const variants = getDiacriticVariants().get(stripDiacritics(char));
    return variants ? `[${variants}]` : escapeRegExp(char);
}

function ligatureAt(term: string, index: number): { pattern: string; length: number } | null {
    const oe = `(?:\u0153|${characterClass('o')}${characterClass('e')})`;
    const upperOe = `(?:\u0152|${characterClass('O')}[Ee])`;

    if (term[index] === '\u0153') return { pattern: oe, length: 1 };
    if (term[index] === '\u0152') return { pattern: upperOe, length: 1 };

    const pair = term.slice(index, index + 2);
    if (pair === 'oe') return { pattern: oe, length: 2 };
    if (pair === 'OE' || pair === 'Oe') return { pattern: upperOe, length: 2 };

    return null;
}

/**
 * Diacritics reach the text two ways: precomposed (\u00e9) or a base letter followed by a
 * combining mark (e + U+0301). Cyrillic stress marks only ever take the second form.
 */
const COMBINING_MARKS_PATTERN = '[̀-ͯ]*';

function isCombiningMark(char: string): boolean {
    const code = char.codePointAt(0) ?? 0;
    return code >= 0x0300 && code <= 0x036f;
}

/**
 * Regex source matching `term` whatever its diacritics, apostrophe style or oe ligature.
 * The document view normalises the text instead, but the notes editor searches the
 * ProseMirror document directly, so the tolerance has to live in the pattern.
 * Case is left to the caller: each class keeps the case of its input character.
 */
export function accentInsensitivePattern(term: string): string {
    const normalized = term.normalize('NFC');
    let pattern = '';

    for (let index = 0; index < normalized.length; index++) {
        const char = normalized[index];
        if (isCombiningMark(char)) continue;

        const ligature = ligatureAt(normalized, index);
        if (ligature) {
            pattern += ligature.pattern + COMBINING_MARKS_PATTERN;
            index += ligature.length - 1;
            continue;
        }

        const base = APOSTROPHES.includes(char) ? `[${APOSTROPHES}]` : characterClass(char);
        pattern += base + COMBINING_MARKS_PATTERN;
    }

    return pattern;
}

export function simpleRegExp(term: string): RegExp {
    return new RegExp(wordPattern(term), 'gi');
}

/** Scripts written without spaces, where one character is already a whole word. */
const SCRIPTIO_CONTINUA =
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Khmer}\p{Script=Lao}\p{Script=Myanmar}]/u;

const MIN_QUERY_LENGTH = 3;

/**
 * Whether a query is long enough to be worth running. Space-delimited scripts need a few
 * characters before the results mean anything, but in scripts written without spaces a
 * single character is a word in its own right.
 */
export function hasSearchableLength(query: string): boolean {
    const trimmed = query.trim();
    if (!trimmed) return false;
    return SCRIPTIO_CONTINUA.test(trimmed) || trimmed.length >= MIN_QUERY_LENGTH;
}

/**
 * Split a query the way Tantivy's SimpleTokenizer does, so the terms we search for are the
 * terms the index holds. It breaks on anything Rust calls non-alphanumeric, which is
 * Unicode Alphabetic plus Number — `\p{L}` alone would shatter Indic words at their vowel
 * signs. Drops single-character noise tokens for the all/any modes.
 */
export function tokenizeQuery(query: string, mode: SearchMode = 'all'): string[] {
    const words = query
        .trim()
        .split(/[^\p{Alphabetic}\p{N}]+/u)
        .filter(Boolean);
    if (mode === 'exact') return words;
    return words.filter((word) => word.length > 1 || SCRIPTIO_CONTINUA.test(word));
}

// ---------------------------------------------------------------------------
// Pattern builders
// ---------------------------------------------------------------------------

const APOSTROPHE_PATTERN = new RegExp(`[${APOSTROPHES}]`, 'g');

function wordPattern(word: string): string {
    return strNormalize(escapeRegExp(word))
        .replace(APOSTROPHE_PATTERN, `[${APOSTROPHES}]`)
        .replace(/(œ|oe)/g, '(œ|oe)');
}

/** \b is ASCII-only; these treat every script's word characters as such, matching the tokenizer. */
const WORD_START = '(?<![\\p{Alphabetic}\\p{N}])';
const WORD_END = '(?![\\p{Alphabetic}\\p{N}])';

/** Anchor a word to its edges, except in scripts that run words together. */
function boundedWordPattern(word: string): string {
    const pattern = wordPattern(word);
    return SCRIPTIO_CONTINUA.test(word) ? pattern : WORD_START + pattern + WORD_END;
}

function buildWordRegex(word: string): RegExp {
    return new RegExp(boundedWordPattern(word), 'giu');
}

/**
 * Build a phrase span regex: matches the entire span from first to last word.
 * Words must appear in order. Allows up to MAX_PHRASE_GAP chars between each pair.
 */
const MAX_PHRASE_GAP = 80;

function buildPhraseSpanRegex(words: string[]): RegExp | null {
    if (words.length === 0) return null;
    if (words.length === 1) return buildWordRegex(words[0]);
    const pattern = words.map(boundedWordPattern).join(`[\\s\\S]{0,${MAX_PHRASE_GAP}}?`);
    return new RegExp(pattern, 'giu');
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
    const patterns = stem ? words.map(boundedWordPattern) : words.map(wordPattern);
    return new RegExp(patterns.join('|'), 'giu');
}

// ---------------------------------------------------------------------------
// List filtering
// ---------------------------------------------------------------------------

/**
 * Ranked from the most literal match to the loosest one still worth showing, so a
 * title that reads back the query outranks one that merely contains its letters.
 */
const SCORE_NO_MATCH = 0;
const SCORE_CONTAINS = 1;
const SCORE_WORD_STARTS = 2;
const SCORE_PHRASE = 3;
const SCORE_PHRASE_AT_START = 4;

/** Whatever separates two words, so "suis moi" reaches "Suis-moi" and "suis  moi" alike. */
const NON_WORD_CLASS = '[^\\p{Alphabetic}\\p{N}]';
const SEPARATOR_PATTERN = `${NON_WORD_CLASS}*`;
const SEPARATORS = new RegExp(`${NON_WORD_CLASS}+`, 'gu');

/** Drop everything between words, so a query may run together what a name keeps apart. */
export function stripSeparators(text: string): string {
    return text.replace(SEPARATORS, '');
}

/** Word starts mean nothing where words run together: there, any position is a start. */
function wordStartPrefix(term: string): string {
    return SCRIPTIO_CONTINUA.test(term) ? '' : WORD_START;
}

interface SearchTerm {
    text: string;
    atWordStart: RegExp;
}

/** A query compiled once, then tested against every candidate in a list. */
export interface SearchQuery {
    terms: SearchTerm[];
    phrase: RegExp;
}

/**
 * Compile a user query for filtering a list. Case and diacritics are folded, and
 * punctuation is dropped on both sides, so the query only has to carry the letters.
 */
export function parseSearchQuery(query: string): SearchQuery | null {
    const terms = tokenizeQuery(query, 'exact').map(strNormalize).filter(Boolean);
    if (terms.length === 0) return null;

    return {
        terms: terms.map((text) => ({
            text,
            atWordStart: new RegExp(wordStartPrefix(text) + escapeRegExp(text), 'u'),
        })),
        phrase: new RegExp(
            wordStartPrefix(terms[0]) + terms.map(escapeRegExp).join(SEPARATOR_PATTERN),
            'u',
        ),
    };
}

/**
 * How well `text` answers the query, or `SCORE_NO_MATCH` when it does not.
 * Every term must be present; where they sit decides the rank.
 */
export function scoreSearchMatch(text: string, query: SearchQuery): number {
    const haystack = strNormalize(text);

    if (query.terms.every((term) => haystack.includes(term.text))) {
        const phrase = query.phrase.exec(haystack);
        if (phrase) return phrase.index === 0 ? SCORE_PHRASE_AT_START : SCORE_PHRASE;

        return query.terms.every((term) => term.atWordStart.test(haystack))
            ? SCORE_WORD_STARTS
            : SCORE_CONTAINS;
    }

    // The query may run together words the title keeps apart: "leglise" for "L'Église".
    const joined = stripSeparators(haystack);
    return query.terms.every((term) => joined.includes(term.text))
        ? SCORE_CONTAINS
        : SCORE_NO_MATCH;
}

/**
 * Filter a list against an already compiled query, best match first.
 * `tieBreak` orders entries the query ranks equally.
 */
export function filterBySearchQuery<T>(
    items: readonly T[],
    query: SearchQuery,
    toText: (item: T) => string,
    tieBreak?: (a: T, b: T) => number,
): T[] {
    return items
        .map((item) => ({ item, score: scoreSearchMatch(toText(item), query) }))
        .filter((entry) => entry.score > SCORE_NO_MATCH)
        .sort((a, b) => b.score - a.score || (tieBreak ? tieBreak(a.item, b.item) : 0))
        .map((entry) => entry.item);
}

/**
 * Filter a list by a raw user query, best match first. A query with no searchable word
 * keeps everything, which is what a search box wants; callers that must reject such a
 * query instead should compile it with `parseSearchQuery` and branch on the null.
 */
export function searchList<T>(
    items: readonly T[],
    query: string,
    toText: (item: T) => string,
    tieBreak?: (a: T, b: T) => number,
): T[] {
    const parsed = parseSearchQuery(query);
    if (!parsed) return tieBreak ? [...items].sort(tieBreak) : [...items];
    return filterBySearchQuery(items, parsed, toText, tieBreak);
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
            ? pattern.replace(APOSTROPHE_PATTERN, `[${APOSTROPHES}]`).replace(/(œ|oe)/g, '(œ|oe)')
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
