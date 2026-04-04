import { useEffect } from 'react';
import {
    buildBibleDocumentId,
    buildBibleDocumentTitle,
    getDocumentIdentityFromTab,
    getDocumentIdentityKey,
    getBibleIndexEntry,
    getTabKey,
    type BibleIndex,
    type BibleTab,
    type BibleVersionInfo,
} from '@shared/types';
import { useAppStore, useDocumentTabsStore } from '@renderer/stores';
import { useTtsStore } from '@renderer/stores/tts.store';
import { buildBibleChapterIntro, buildSegmentAnnouncement } from '@shared/tts.types';
import { startTtsPlayback } from '@renderer/hooks/use-tts';

let cachedBibleVersions: BibleVersionInfo[] | null = null;

export type BiblePlaybackSource = {
    tabKey: string;
    bibleBook: string;
    bibleChapter: string;
    bibleVersionAbbreviation: string;
};

export type BibleChapterTarget = {
    title: string;
    documentId: string;
    bibleBook: string;
    bibleChapter: string;
    bibleVersionAbbreviation: string;
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
        bibleVersionAbbreviation: tab.bibleVersionAbbreviation,
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

    const chapterList = bookEntry.value.chapters
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
        title: buildBibleDocumentTitle(
            bookEntry.bookName,
            nextChapter,
            source.bibleVersionAbbreviation,
        ),
        documentId: buildBibleDocumentId(source.bibleBook, nextChapter),
        bibleBook: source.bibleBook,
        bibleChapter: nextChapter,
        bibleVersionAbbreviation: source.bibleVersionAbbreviation,
    };
}

function versesToParagraphs(verses: { verse: string; content: string }[]) {
    return verses
        .slice()
        .sort((a, b) => +a.verse - +b.verse)
        .map((verse) => ({
            paragraphIndex: +verse.verse,
            content: verse.content,
        }));
}

async function getBibleVersions(): Promise<BibleVersionInfo[]> {
    if (cachedBibleVersions) {
        return cachedBibleVersions;
    }

    const versions = await window.api.bible.getAllVersions();
    cachedBibleVersions = versions;
    return versions;
}

export function useBibleTtsContinuation(): void {
    const tabs = useDocumentTabsStore((s) => s.tabs);
    const updateBibleTab = useDocumentTabsStore((s) => s.updateBibleTab);
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const settings = useTtsStore((s) => s.settings);
    const completedNaturally = useTtsStore((s) => s.completedNaturally);
    const lastCompletedDocumentKey = useTtsStore((s) => s.lastCompletedDocumentKey);
    const clearCompletedNaturally = useTtsStore((s) => s.clearCompletedNaturally);

    useEffect(() => {
        if (!completedNaturally || !settings?.bibleReadEntireBook || !lastCompletedDocumentKey) {
            return;
        }

        clearCompletedNaturally();

        const sourceTab = tabs.find((tab) => {
            if (tab.type !== 'bible') {
                return false;
            }

            return (
                getDocumentIdentityKey(getDocumentIdentityFromTab(tab)) === lastCompletedDocumentKey
            );
        });

        if (!sourceTab || sourceTab.type !== 'bible') {
            return;
        }

        const source = captureBiblePlaybackSource(sourceTab, getTabKey(sourceTab));
        if (!source) {
            return;
        }

        let cancelled = false;

        void (async () => {
            const [bibleIndex, versions] = await Promise.all([
                window.api.bible.getIndexes(sourceTab.bibleVersionAbbreviation),
                getBibleVersions(),
            ]);

            if (cancelled) {
                return;
            }

            const nextTarget = resolveNextBibleChapterTarget(source, bibleIndex);
            if (!nextTarget) {
                return;
            }

            updateBibleTab(source.tabKey, nextTarget);

            const nextLanguage =
                versions.find(
                    (version) => version.abbreviation === nextTarget.bibleVersionAbbreviation,
                )?.langCode ??
                contentLanguage ??
                '';

            if (contentLanguage && nextLanguage && nextLanguage !== contentLanguage) {
                return;
            }

            const verses = await window.api.bible.getBooks({
                book: nextTarget.bibleBook,
                chapter: nextTarget.bibleChapter,
                bibleVersionAbbreviation: nextTarget.bibleVersionAbbreviation,
            });

            if (cancelled || verses.length === 0) {
                return;
            }

            const bookName = getBibleIndexEntry(bibleIndex, nextTarget.bibleBook)?.bookName ?? '';
            const introText =
                bookName && nextLanguage
                    ? buildBibleChapterIntro(bookName, nextTarget.bibleChapter, nextLanguage)
                    : undefined;

            await startTtsPlayback(
                versesToParagraphs(verses),
                nextLanguage,
                getDocumentIdentityKey(
                    getDocumentIdentityFromTab({
                        ...sourceTab,
                        title: nextTarget.title,
                        documentId: nextTarget.documentId,
                        bibleBook: nextTarget.bibleBook,
                        bibleChapter: nextTarget.bibleChapter,
                        bibleVersionAbbreviation: nextTarget.bibleVersionAbbreviation,
                    }),
                ),
                {
                    introText,
                    getSegmentLabel: (paragraphIndex) =>
                        buildSegmentAnnouncement('verse', paragraphIndex, nextLanguage),
                },
            );
        })();

        return () => {
            cancelled = true;
        };
    }, [
        clearCompletedNaturally,
        completedNaturally,
        contentLanguage,
        lastCompletedDocumentKey,
        settings?.bibleReadEntireBook,
        tabs,
        updateBibleTab,
    ]);
}
