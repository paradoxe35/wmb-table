import type { SearchMatchersValue } from '@shared/types';

export function regexpMatcher(pattern: string | RegExp, headstack: string): SearchMatchersValue[] {
    const regexp = new RegExp(
        typeof pattern === 'string'
            ? pattern.replace(/['|']/g, "[''']").replace(/(œ|oe)/g, '(œ|oe)')
            : pattern,
        'gi',
    );
    const matches = [...headstack.matchAll(regexp)];

    return matches.map((match, i) => ({
        term: match[0],
        index: i + 1,
        start: match.index,
        end: match.index != null ? match.index + match[0].length : undefined,
    }));
}

export function strNormalizeNoLower(str: string | null): string {
    return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
}

export function simpleRegExp(term: string): RegExp {
    return new RegExp(
        strNormalize(escapeRegExp(term))
            .replace(/['|']/g, "[''']")
            .replace(/(œ|oe)/g, '(œ|oe)'),
        'gi',
    );
}

export function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function toSearchableTerms(term: string): string {
    const terms = strNormalizeNoLower(escapeRegExp(term.trim()))
        .split(' ')
        .filter(Boolean)
        .join('[a-zA-Z]*([^\\s+]*)?');
    return `${terms}[a-zA-Z]*`;
}

export function performSearch(needle: string, headstack: string): SearchMatchersValue[] {
    const terms = toSearchableTerms(needle);
    return regexpMatcher(terms, headstack);
}

export function strNormalize(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase();
}

export function surroundContentsTag(
    node: Node,
    index: string | undefined,
    start: number,
    end: number,
): Range {
    const range = document.createRange();
    const tag = document.createElement('mark');
    if (index != null) tag.dataset.markId = index;
    range.setStart(node, start);
    range.setEnd(node, end);
    range.surroundContents(tag);
    return range;
}
