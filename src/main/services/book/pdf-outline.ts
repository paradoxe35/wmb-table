import type { PdfOutlineEntry } from '../pdf-extract.service';
import type { BookChapter } from '@shared/types';

/**
 * Whether the PDF's own bookmarks can serve as the chapter list. They beat
 * anything on the page when present, but an outline is just as often a link
 * menu or a lone cover entry, so its shape is checked before it is believed.
 */

const MIN_OUTLINE_CHAPTERS = 2;
/** More bookmarks than this and the outline is indexing paragraphs, not chapters. */
const MAX_CHAPTERS_PER_PAGE = 0.25;

export function chaptersFromOutline(
    entries: PdfOutlineEntry[],
    pageCount: number,
): BookChapter[] | null {
    const top = entries.filter((entry) => entry.level === 1);
    if (top.length < MIN_OUTLINE_CHAPTERS || top.length > pageCount * MAX_CHAPTERS_PER_PAGE) {
        return null;
    }

    const withinDocument = top.every((entry) => entry.page >= 1 && entry.page <= pageCount);
    const increasing = top.every((entry, index) => index === 0 || entry.page > top[index - 1].page);
    if (!withinDocument || !increasing) return null;

    return top.map((entry, index) => ({
        id: `c${index + 1}`,
        title: entry.title,
        page: entry.page,
        firstParagraph: 0,
        level: entry.level,
    }));
}
