import { useEffect, useState } from 'react';
import { useAppStore, useSermonStore, selectActiveTab } from '@renderer/stores';
import type {
    BibleBook,
    CustomDocumentContent,
    DocumentTab,
    DocumentType,
    SermonContent,
    SermonMetaWithTraductions,
} from '@shared/types';

const contentCache = new Map<string, SermonContent>();

export function buildSermonContentKey(
    languageCode: string,
    translationId: number,
    sermonId: string,
) {
    return `${languageCode}:${translationId}:${sermonId}`;
}

export function buildBibleChapterKey(book: string, chapter: string) {
    return `${book}:${chapter}`;
}

export function buildReadingPositionKey(documentType: DocumentType, documentKey: string) {
    return `${documentType}:${documentKey}`;
}

type ScrollPersistenceState = {
    restoreIdentity: string | null;
    readingPositionKey: string | null;
};

export function resolveSermonScrollPersistence(
    activeTab: DocumentTab | null,
    sermonInfo: SermonMetaWithTraductions | undefined,
    activeLanguage: string | null,
    content: SermonContent | null,
): ScrollPersistenceState {
    if (!activeTab) {
        return { restoreIdentity: null, readingPositionKey: null };
    }

    const languageCode = activeTab.languageCode ?? activeLanguage;
    if (!languageCode) {
        return { restoreIdentity: null, readingPositionKey: null };
    }

    const translationId = activeTab.translationId ?? sermonInfo?.translationId ?? 0;
    const contentKey = buildSermonContentKey(languageCode, translationId, activeTab.sermonId);
    const matchesLoadedContent =
        content?.meta.sermonId === activeTab.sermonId &&
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
): ScrollPersistenceState {
    if (!bookCode || !chapter) {
        return { restoreIdentity: null, readingPositionKey: null };
    }

    const chapterKey = buildBibleChapterKey(bookCode, chapter);
    return {
        restoreIdentity: loadedChapterKey === chapterKey ? chapterKey : null,
        readingPositionKey: buildReadingPositionKey('bible', chapterKey),
    };
}

export function useSermonContent() {
    const activeTab = useSermonStore(selectActiveTab);
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const sermonsById = useSermonStore((s) => s.sermonsById);
    const setActiveContent = useSermonStore((s) => s.setActiveContent);
    const activeContent = useSermonStore((s) => s.activeContent);
    const [loading, setLoading] = useState(false);

    const tabSermonId = activeTab?.sermonId;
    const tabTranslationId = activeTab?.translationId;
    const tabLanguage = activeTab?.languageCode ?? activeLanguage;

    useEffect(() => {
        if (!tabSermonId || !tabLanguage) {
            setActiveContent(null);
            return;
        }

        let cancelled = false;
        const meta = sermonsById[tabSermonId];
        const translationId = tabTranslationId ?? meta?.translationId ?? 0;
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
                contentCache.set(cacheKey, content);
                setActiveContent(content);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('[useSermonContent] Failed to load:', err);
                setActiveContent(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [tabSermonId, tabLanguage, sermonsById, setActiveContent, tabTranslationId]);

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

        let cancelled = false;
        setLoading(true);
        setContent(null);

        window.api.app
            .getCustomDocumentContent(documentId)
            .then((nextContent) => {
                if (!cancelled) setContent(nextContent);
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

export function useBibleChapterContent(book?: string, chapter?: string) {
    const [verses, setVerses] = useState<BibleBook[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!book || !chapter) {
            setVerses([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setVerses([]);

        window.api.bible
            .getBooks({ book, chapter })
            .then((nextVerses) => {
                if (!cancelled) setVerses(nextVerses);
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
    }, [book, chapter]);

    return { verses, loading };
}
