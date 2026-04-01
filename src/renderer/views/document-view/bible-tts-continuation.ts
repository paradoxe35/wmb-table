import type { BibleIndexValue, DocumentTab } from '@shared/types';

export type BiblePlaybackSource = {
    tabKey: string;
    bibleBook: string;
    bibleChapter: string;
};

export type BibleChapterTarget = {
    title: string;
    sermonId: string;
    bibleBook: string;
    bibleChapter: string;
};

export function captureBiblePlaybackSource(
    tab: DocumentTab | null,
    tabKey: string | null,
): BiblePlaybackSource | null {
    if (!tabKey || tab?.type !== 'bible' || !tab.bibleBook || !tab.bibleChapter) {
        return null;
    }

    return {
        tabKey,
        bibleBook: tab.bibleBook,
        bibleChapter: tab.bibleChapter,
    };
}

export function resolveNextBibleChapterTarget(
    source: BiblePlaybackSource | null,
    bibleIndex: Record<string, BibleIndexValue>,
): BibleChapterTarget | null {
    if (!source) {
        return null;
    }

    const bookEntry =
        Object.entries(bibleIndex).find(([, value]) => value.book === source.bibleBook) ?? null;
    if (!bookEntry) {
        return null;
    }

    const [bookName, bookValue] = bookEntry;
    const chapterList = bookValue.chapters
        .split(',')
        .map((chapter) => chapter.trim())
        .filter(Boolean)
        .sort((a, b) => Number(a) - Number(b));
    const currentIndex = chapterList.indexOf(source.bibleChapter);
    if (currentIndex < 0 || currentIndex >= chapterList.length - 1) {
        return null;
    }

    const nextChapter = chapterList[currentIndex + 1];
    return {
        title: `${bookName} ${nextChapter}`,
        sermonId: `${source.bibleBook}:${nextChapter}`,
        bibleBook: source.bibleBook,
        bibleChapter: nextChapter,
    };
}
