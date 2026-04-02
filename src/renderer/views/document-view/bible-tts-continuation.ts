import {
    buildBibleDocumentId,
    buildBibleDocumentTitle,
    getBibleIndexEntry,
    type BibleIndex,
    type BibleTab,
} from '@shared/types';

export type BiblePlaybackSource = {
    tabKey: string;
    bibleBook: string;
    bibleChapter: string;
};

export type BibleChapterTarget = {
    title: string;
    documentId: string;
    bibleBook: string;
    bibleChapter: string;
};

export function captureBiblePlaybackSource(
    tab: BibleTab | null,
    tabKey: string | null,
): BiblePlaybackSource | null {
    if (!tabKey || !tab) {
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
    bibleIndex: BibleIndex,
): BibleChapterTarget | null {
    if (!source) {
        return null;
    }

    const bookEntry = getBibleIndexEntry(bibleIndex, source.bibleBook);
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
        title: buildBibleDocumentTitle(bookName, nextChapter),
        documentId: buildBibleDocumentId(source.bibleBook, nextChapter),
        bibleBook: source.bibleBook,
        bibleChapter: nextChapter,
    };
}
