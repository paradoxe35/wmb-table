import { useEffect, useState } from 'react';
import { useDocumentTabsStore, useSermonStore, selectActiveSermonTab } from '@renderer/stores';
import type {
    BibleBook,
    CustomDocumentContent,
    DocumentType,
    SermonContent,
    SermonTab,
} from '@shared/types';
import { normalizeBibleAbbreviation } from '@shared/types';

const MAX_CACHE_ENTRIES = 50;

function boundedSet<V>(cache: Map<string, V>, key: string, value: V): void {
    cache.delete(key);
    cache.set(key, value);
    if (cache.size > MAX_CACHE_ENTRIES) {
        cache.delete(cache.keys().next().value!);
    }
}

const contentCache = new Map<string, SermonContent>();
const bibleCache = new Map<string, BibleBook[]>();
const customDocCache = new Map<string, CustomDocumentContent>();

export function buildSermonContentKey(
    languageCode: string,
    translationId: number,
    sermonId: string,
) {
    return `${languageCode}:${translationId}:${sermonId}`;
}

export function buildBibleChapterKey(book: string, chapter: string, versionAbbreviation?: string) {
    const normalizedVersion = versionAbbreviation
        ? normalizeBibleAbbreviation(versionAbbreviation)
        : '';

    return normalizedVersion ? `${normalizedVersion}:${book}:${chapter}` : `${book}:${chapter}`;
}

export function buildReadingPositionKey(documentType: DocumentType, documentKey: string) {
    return `${documentType}:${documentKey}`;
}

type ScrollPersistenceState = {
    restoreIdentity: string | null;
    readingPositionKey: string | null;
};

export function resolveSermonScrollPersistence(
    activeTab: SermonTab | null,
    content: SermonContent | null,
): ScrollPersistenceState {
    if (!activeTab) {
        return { restoreIdentity: null, readingPositionKey: null };
    }

    const languageCode = activeTab.languageCode;
    const translationId = activeTab.translationId;
    const contentKey = buildSermonContentKey(languageCode, translationId, activeTab.documentId);
    const matchesLoadedContent =
        content?.meta.sermonId === activeTab.documentId &&
        content.meta.languageCode === languageCode &&
        content.meta.translationId === translationId;

    return {
        restoreIdentity: matchesLoadedContent ? contentKey : null,
        readingPositionKey: buildReadingPositionKey('sermon', contentKey),
    };
}

export function resolveCustomDocumentScrollPersistence(
    customDocId?: string,
    loadedDocId?: string,
): ScrollPersistenceState {
    if (!customDocId) {
        return { restoreIdentity: null, readingPositionKey: null };
    }

    return {
        restoreIdentity: loadedDocId === customDocId ? customDocId : null,
        readingPositionKey: buildReadingPositionKey('custom', customDocId),
    };
}

export function resolveBibleScrollPersistence(
    bookCode?: string,
    chapter?: string,
    loadedChapterKey?: string | null,
    bibleVersionAbbreviation?: string,
): ScrollPersistenceState {
    if (!bookCode || !chapter || !bibleVersionAbbreviation) {
        return { restoreIdentity: null, readingPositionKey: null };
    }

    const chapterKey = buildBibleChapterKey(bookCode, chapter, bibleVersionAbbreviation);
    return {
        restoreIdentity: loadedChapterKey === chapterKey ? chapterKey : null,
        readingPositionKey: buildReadingPositionKey('bible', chapterKey),
    };
}

export function useSermonContent() {
    const activeTab = useDocumentTabsStore(selectActiveSermonTab);
    const setActiveContent = useSermonStore((s) => s.setActiveContent);
    const activeContent = useSermonStore((s) => s.activeContent);
    const [loading, setLoading] = useState(false);

    const tabSermonId = activeTab?.documentId;
    const tabTranslationId = activeTab?.translationId;
    const tabLanguage = activeTab?.languageCode;

    useEffect(() => {
        if (!activeTab || !tabSermonId || !tabLanguage) {
            setActiveContent(null);
            return;
        }

        let cancelled = false;
        const translationId = activeTab.translationId;
        const cacheKey = buildSermonContentKey(tabLanguage, translationId, tabSermonId);
        const cached = contentCache.get(cacheKey);
        if (cached) {
            setActiveContent(cached);
            setLoading(false);
            return () => {
                cancelled = true;
            };
        }

        setActiveContent(null);
        setLoading(true);
        window.api.documents
            .getSermonContent(tabLanguage, translationId, tabSermonId)
            .then((content) => {
                if (cancelled) return;
                boundedSet(contentCache, cacheKey, content);
                setActiveContent(content);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('[useSermonContent] Failed to load:', err);
                setActiveContent(null);
                setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [activeTab, tabSermonId, tabLanguage, setActiveContent, tabTranslationId]);

    return { content: activeContent, loading };
}

export function useCustomDocumentContent(documentId?: string) {
    const [content, setContent] = useState<CustomDocumentContent | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!documentId) {
            setContent(null);
            setLoading(false);
            return;
        }

        const cached = customDocCache.get(documentId);
        if (cached) {
            setContent(cached);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setContent(null);

        window.api.app
            .getCustomDocumentContent(documentId)
            .then((nextContent) => {
                if (cancelled) return;
                if (nextContent) {
                    boundedSet(customDocCache, documentId, nextContent);
                }
                setContent(nextContent);
            })
            .catch(() => {
                if (!cancelled) setContent(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [documentId]);

    return { content, loading };
}

export function useBibleChapterContent(
    book?: string,
    chapter?: string,
    versionAbbreviation?: string,
) {
    const [verses, setVerses] = useState<BibleBook[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!book || !chapter) {
            setVerses([]);
            setLoading(false);
            return;
        }

        const cacheKey = buildBibleChapterKey(book, chapter, versionAbbreviation);
        const cached = bibleCache.get(cacheKey);
        if (cached) {
            setVerses(cached);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setVerses([]);
        setLoading(true);

        window.api.bible
            .getBooks({
                book,
                chapter,
                bibleVersionAbbreviation: versionAbbreviation,
            })
            .then((nextVerses) => {
                if (cancelled) return;
                boundedSet(bibleCache, cacheKey, nextVerses);
                setVerses(nextVerses);
            })
            .catch(() => {
                if (!cancelled) setVerses([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [book, chapter, versionAbbreviation]);

    return { verses, loading };
}
