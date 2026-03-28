import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import i18n from '@renderer/i18n';
import { useAppStore, useSermonStore, selectActiveTabTitle } from '@renderer/stores';
import { useThemeStore } from '@renderer/stores/theme.store';
import { DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import type {
    DocumentType,
    DocumentHtmlTree,
    NoteItemReference,
    ParagraphReference,
    SermonMetaWithTraductions,
    SubjectDocumentItem,
} from '@shared/types';
import { formatSermonDate } from '@renderer/utils/sermon-utils';
import { buildPendingNavigationTarget } from '@renderer/utils/pending-navigation';
import { capitalize } from 'lodash';
import { isParagraphReference } from '@shared/types';

export { useContainerHeight } from './use-container-height';
export { useTabPersistence } from './use-tab-persistence';

type BaseOpenDocumentRequest = {
    title: string;
    sermonId: string;
};

type SermonOpenDocumentRequest = BaseOpenDocumentRequest & {
    documentType: 'sermon';
    translationId?: number;
    bibleBook?: never;
    bibleChapter?: never;
    bibleVersionAbbreviation?: never;
    customDocumentId?: never;
};

type BibleOpenDocumentRequest = BaseOpenDocumentRequest & {
    documentType: 'bible';
    bibleBook?: string;
    bibleChapter?: string;
    bibleVersionAbbreviation?: string;
    translationId?: never;
    customDocumentId?: never;
};

type CustomOpenDocumentRequest = BaseOpenDocumentRequest & {
    documentType: 'custom';
    customDocumentId?: string;
    translationId?: never;
    bibleBook?: never;
    bibleChapter?: never;
    bibleVersionAbbreviation?: never;
};

export type OpenDocumentRequest =
    | SermonOpenDocumentRequest
    | BibleOpenDocumentRequest
    | CustomOpenDocumentRequest;

export function buildPendingNavigation(
    request: OpenDocumentRequest,
    documentHtmlTree: DocumentHtmlTree | ParagraphReference,
) {
    return {
        target: buildPendingNavigationTarget(request),
        documentHtmlTree,
    };
}

function snapshotActiveDocumentScroll(updateTabScroll: (key: string, scrollY?: number) => void) {
    const currentTab = useSermonStore.getState().tabs.find((tab) => tab.active);
    const container = document.getElementById(DOCUMENT_CONTAINER_ID);
    if (!currentTab || !container) return;
    updateTabScroll(`${currentTab.title}::${currentTab.sermonId}`, container.scrollTop);
}

function resolveReferenceDocumentType(
    reference:
        | ParagraphReference
        | SubjectDocumentItem['documentHtmlTree']
        | NoteItemReference['documentHtmlTree'],
): DocumentType {
    if (isParagraphReference(reference) && reference.documentType) {
        return reference.documentType;
    }
    return 'sermon';
}

export function buildReferenceOpenRequest(
    title: string,
    sermonId: string,
    reference: SubjectDocumentItem['documentHtmlTree'] | NoteItemReference['documentHtmlTree'],
): OpenDocumentRequest {
    const documentType = resolveReferenceDocumentType(reference);
    if (documentType === 'custom') {
        return {
            title,
            sermonId,
            documentType,
        };
    }
    if (documentType === 'bible' && isParagraphReference(reference)) {
        return {
            title,
            sermonId,
            documentType,
            bibleBook: reference.bibleBook,
            bibleChapter: reference.bibleChapter,
            bibleVersionAbbreviation: reference.bibleVersionAbbreviation,
        };
    }
    return {
        title,
        sermonId,
        documentType: 'sermon',
        translationId: isParagraphReference(reference) ? reference.translationId : undefined,
    };
}

export function useValueStateRef<T>(value: T) {
    const ref = useRef<T>(value);
    ref.current = useMemo(() => value, [value]);
    return ref;
}

export const useIpcRequestWithLoader = () => {
    const setLoaded = useAppStore((s) => s.setLoaded);

    return useCallback(
        async <T>(fn: () => Promise<T>): Promise<T> => {
            setLoaded(false);
            try {
                return await fn();
            } finally {
                setLoaded(true);
            }
        },
        [setLoaded],
    );
};

export function useInitApp() {
    const setLoaded = useAppStore((s) => s.setLoaded);
    const setSidebarHidden = useAppStore((s) => s.setSidebarHidden);
    const setContentLanguage = useAppStore((s) => s.setContentLanguage);
    const setActiveBibleVersion = useAppStore((s) => s.setActiveBibleVersion);
    const setRememberReadingPosition = useAppStore((s) => s.setRememberReadingPosition);
    const setSermons = useSermonStore((s) => s.setSermons);
    const setTabs = useSermonStore((s) => s.setTabs);

    const setError = useAppStore((s) => s.setError);

    useEffect(() => {
        (async () => {
            try {
                const installed = await window.api.languages.getInstalled();

                // No languages installed — language modal auto-opens itself
                if (installed.length === 0) {
                    setLoaded(true);
                    return;
                }

                const [dbContentLanguage, dbUiLanguage] = await Promise.all([
                    window.api.app.getContentLanguage(),
                    window.api.app.getUiLanguage(),
                ]);

                const [rememberReadingPosition, maxTabs, sidebarStatus] = await Promise.all([
                    window.api.app.getRememberReadingPosition(),
                    window.api.app.getMaxTabs(),
                    window.api.app.getSidebarStatus(),
                ]);

                if (sidebarStatus) {
                    setSidebarHidden(sidebarStatus.hidden);
                }
                setRememberReadingPosition(rememberReadingPosition);
                useAppStore.getState().setMaxTabs(maxTabs);

                // Sync UI language preference from DB (null = auto)
                const pref = dbUiLanguage ?? 'auto';
                if (pref !== useThemeStore.getState().uiLanguagePreference) {
                    useThemeStore.getState().setUiLanguagePreference(pref);
                }

                // Validate content language is still installed
                const validLang =
                    dbContentLanguage && installed.some((l) => l.code === dbContentLanguage);

                if (!validLang) {
                    // No persisted language or it was uninstalled — language modal will open
                    setLoaded(true);
                    return;
                }

                setContentLanguage(dbContentLanguage);
                const [sermons, savedTabs, bibleVersion] = await Promise.all([
                    window.api.documents.getTitles(dbContentLanguage),
                    window.api.documents.getTabs(dbContentLanguage),
                    window.api.bible.getActiveVersion(),
                ]);
                setActiveBibleVersion(bibleVersion);

                setSermons(sermons);
                if (savedTabs?.length) {
                    setTabs(savedTabs);
                }
            } catch (err) {
                console.error('[useInitApp] Initialization failed:', err);
                setError(i18n.t("Erreur lors de l'initialisation de l'application"));
            } finally {
                setLoaded(true);
            }
        })();
    }, [
        setLoaded,
        setSidebarHidden,
        setContentLanguage,
        setActiveBibleVersion,
        setRememberReadingPosition,
        setSermons,
        setTabs,
        setError,
    ]);
}

export function useOpenDocument() {
    const addTab = useSermonStore((s) => s.addTab);
    const setMainView = useAppStore((s) => s.setMainView);
    const updateTabScroll = useSermonStore((s) => s.updateTabScroll);

    return useCallback(
        (title: string, sermonId: string, translationId?: number) => {
            snapshotActiveDocumentScroll(updateTabScroll);
            addTab(title, sermonId, 'sermon', undefined, translationId);
            setMainView('document');
        },
        [addTab, setMainView, updateTabScroll],
    );
}

export function useOpenCustomDocument() {
    const addTab = useSermonStore((s) => s.addTab);
    const setMainView = useAppStore((s) => s.setMainView);
    const updateTabScroll = useSermonStore((s) => s.updateTabScroll);

    return useCallback(
        (title: string, sermonId: string) => {
            snapshotActiveDocumentScroll(updateTabScroll);
            addTab(title, sermonId, 'custom');
            setMainView('document');
        },
        [addTab, setMainView, updateTabScroll],
    );
}

export function useOpenBibleChapter() {
    const addTab = useSermonStore((s) => s.addTab);
    const setMainView = useAppStore((s) => s.setMainView);
    const updateTabScroll = useSermonStore((s) => s.updateTabScroll);

    return useCallback(
        (bookName: string, bookCode: string, chapter: string) => {
            snapshotActiveDocumentScroll(updateTabScroll);
            const title = `${bookName} ${chapter}`;
            const sermonId = `${bookCode}:${chapter}`;
            addTab(title, sermonId, 'bible', undefined, undefined, bookCode, chapter);
            setMainView('document');
        },
        [addTab, setMainView, updateTabScroll],
    );
}

export function useOpenDocumentRequest() {
    const openDocument = useOpenDocument();
    const openCustomDocument = useOpenCustomDocument();
    const openBibleChapter = useOpenBibleChapter();

    return useCallback(
        async (request: OpenDocumentRequest) => {
            if (request.documentType === 'custom') {
                openCustomDocument(request.title, request.sermonId);
                return;
            }

            if (request.documentType === 'bible' && request.bibleBook && request.bibleChapter) {
                if (request.bibleVersionAbbreviation) {
                    await window.api.bible.switchVersion(request.bibleVersionAbbreviation);
                    const v = await window.api.bible.getActiveVersion();
                    useAppStore.getState().setActiveBibleVersion(v);
                }
                const bookName = request.title.replace(
                    new RegExp(`\\s+${request.bibleChapter}$`),
                    '',
                );
                openBibleChapter(bookName, request.bibleBook, request.bibleChapter);
                return;
            }

            openDocument(request.title, request.sermonId, request.translationId);
        },
        [openBibleChapter, openCustomDocument, openDocument],
    );
}

export function useShowOptions() {
    const showOptions = useAppStore((s) => s.showOptions);
    return showOptions;
}

export function useActiveTabTitle(): string | null {
    return useSermonStore(selectActiveTabTitle);
}

export function useSermonLookup() {
    const sermonsById = useSermonStore((s) => s.sermonsById);

    const getSermonById = useCallback(
        (sermonId: string): SermonMetaWithTraductions | undefined => sermonsById[sermonId],
        [sermonsById],
    );

    return { sermonsById, getSermonById };
}

export function useFormatSermonDate() {
    const contentLanguage = useAppStore((s) => s.contentLanguage);

    return useCallback(
        (dateMs: number) => capitalize(formatSermonDate(dateMs, contentLanguage ?? 'en')),
        [contentLanguage],
    );
}

export function useModalVisible() {
    const [visible, setVisible] = useState(false);
    const show = useCallback(() => setVisible(true), []);
    const hide = useCallback(() => setVisible(false), []);
    return { visible, show, hide, setVisible };
}

export const useCallbackUpdater = <T extends (...args: any[]) => any>(callback?: T) => {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    return useCallback((...args: Parameters<T>): ReturnType<T> => {
        return callbackRef.current!(...args);
    }, []) as T;
};
