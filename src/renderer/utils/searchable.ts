// Re-export shared searchable utilities used by renderer
export {
    strNormalizeNoLower,
    strNormalize,
    matchesQuery,
    buildHighlightRegex,
    getHighlightRanges,
    paragraphContainsAllWords,
    searchList,
} from '@shared/searchable';

// DOM-specific utility (cannot live in shared)
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
