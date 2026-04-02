import { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '@renderer/i18n';
import {
    useAppStore,
    useDocumentTabsStore,
    useSermonStore,
    selectActiveTabTitle,
} from '@renderer/stores';
import { useThemeStore } from '@renderer/stores/theme.store';
import { DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import type {
    BibleVersionInfo,
    BibleDocumentIdentity,
    DocumentReference,
    DocumentIdentity,
    DocumentTab,
    NoteItemReference,
    SermonMetaWithTraductions,
    SubjectDocumentItem,
} from '@shared/types';
import { formatSermonDate } from '@renderer/utils/sermon-utils';
import { capitalize } from 'lodash';
import { buildBibleDocumentId, getTabKey } from '@shared/types';

export { useContainerHeight } from './use-container-height';
export { useTabPersistence } from './use-tab-persistence';

export type OpenDocumentRequest = { title: string } & DocumentIdentity;

type LanguageWorkspace = {
    sermons: SermonMetaWithTraductions[];
    tabs: DocumentTab[];
    activeBibleVersion: BibleVersionInfo | null;
};

export function buildPendingNavigation(
    request: OpenDocumentRequest,
    documentReference: DocumentReference,
) {
    const { title: _title, ...target } = request;
    return {
        target,
        documentReference,
    };
}

function snapshotActiveDocumentScroll(updateTabScroll: (key: string, scrollY?: number) => void) {
    const currentTab = useDocumentTabsStore.getState().tabs.find((tab) => tab.active);
    const container = document.getElementById(DOCUMENT_CONTAINER_ID);
    if (!currentTab || !container) return;
    updateTabScroll(getTabKey(currentTab), container.scrollTop);
}

export function buildReferenceOpenRequest(
    title: string,
    reference: SubjectDocumentItem['documentReference'] | NoteItemReference['documentReference'],
): OpenDocumentRequest {
    if (!reference) {
        throw new Error('Missing document reference');
    }

    return {
        title,
        ...reference.documentIdentity,
    };
}

export function useValueStateRef<T>(value: T) {
    const ref = useRef<T>(value);
    ref.current = value;
    return ref;
}

export async function fetchLanguageWorkspace(langCode: string): Promise<LanguageWorkspace> {
    const [sermons, savedTabs, activeBibleVersion] = await Promise.all([
        window.api.documents.getTitles(langCode),
        window.api.documents.getTabs(langCode),
        window.api.bible.getActiveVersion(),
    ]);

    return {
        sermons,
        tabs: savedTabs?.length ? savedTabs : [],
        activeBibleVersion,
    };
}

export function applyLanguageWorkspace(langCode: string, workspace: LanguageWorkspace): void {
    useAppStore.getState().setContentLanguage(langCode);
    useAppStore.getState().setActiveBibleVersion(workspace.activeBibleVersion);
    useSermonStore.getState().setSermons(workspace.sermons);
    useDocumentTabsStore.getState().setTabs(workspace.tabs);
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
    const setRememberReadingPosition = useAppStore((s) => s.setRememberReadingPosition);
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

                const workspace = await fetchLanguageWorkspace(dbContentLanguage);
                applyLanguageWorkspace(dbContentLanguage, workspace);
            } catch (err) {
                console.error('[useInitApp] Initialization failed:', err);
                setError(i18n.t("Erreur lors de l'initialisation de l'application"));
            } finally {
                setLoaded(true);
            }
        })();
    }, [setLoaded, setSidebarHidden, setRememberReadingPosition, setError]);
}

export function useOpenDocument() {
    const addTab = useDocumentTabsStore((s) => s.addTab);
    const setMainView = useAppStore((s) => s.setMainView);
    const updateTabScroll = useDocumentTabsStore((s) => s.updateTabScroll);
    const contentLanguage = useAppStore((s) => s.contentLanguage);

    return useCallback(
        (title: string, sermonId: string, translationId: number) => {
            if (!contentLanguage) {
                return;
            }

            snapshotActiveDocumentScroll(updateTabScroll);
            addTab({
                title,
                documentId: sermonId,
                type: 'sermon',
                languageCode: contentLanguage,
                translationId,
            });
            setMainView('document');
        },
        [addTab, contentLanguage, setMainView, updateTabScroll],
    );
}

export function useOpenCustomDocument() {
    const addTab = useDocumentTabsStore((s) => s.addTab);
    const setMainView = useAppStore((s) => s.setMainView);
    const updateTabScroll = useDocumentTabsStore((s) => s.updateTabScroll);

    return useCallback(
        (title: string, documentId: string) => {
            snapshotActiveDocumentScroll(updateTabScroll);
            addTab({
                title,
                documentId,
                type: 'custom',
            });
            setMainView('document');
        },
        [addTab, setMainView, updateTabScroll],
    );
}

type OpenBibleChapterRequest = BibleDocumentIdentity & { title: string };

export function useOpenBibleChapter() {
    const addTab = useDocumentTabsStore((s) => s.addTab);
    const setMainView = useAppStore((s) => s.setMainView);
    const updateTabScroll = useDocumentTabsStore((s) => s.updateTabScroll);

    return useCallback(
        ({ title, bibleBook, bibleChapter, bibleVersionAbbreviation }: OpenBibleChapterRequest) => {
            snapshotActiveDocumentScroll(updateTabScroll);
            addTab({
                title,
                documentId: buildBibleDocumentId(bibleBook, bibleChapter),
                type: 'bible',
                bibleBook,
                bibleChapter,
                bibleVersionAbbreviation,
            });
            setMainView('document');
        },
        [addTab, setMainView, updateTabScroll],
    );
}

export function useOpenDocumentRequest() {
    const openDocument = useOpenDocument();
    const openCustomDocument = useOpenCustomDocument();
    const openBibleChapter = useOpenBibleChapter();
    const updateBibleTabsVersion = useDocumentTabsStore((s) => s.updateBibleTabsVersion);

    return useCallback(
        async (request: OpenDocumentRequest) => {
            if (request.documentType === 'custom') {
                openCustomDocument(request.title, request.customDocumentId);
                return;
            }

            if (request.documentType === 'bible') {
                await window.api.bible.switchVersion(request.bibleVersionAbbreviation);
                const v = await window.api.bible.getActiveVersion();
                useAppStore.getState().setActiveBibleVersion(v);
                if (v?.abbreviation) {
                    updateBibleTabsVersion(v.abbreviation);
                }
                openBibleChapter(request);
                return;
            }

            openDocument(request.title, request.sermonId, request.translationId);
        },
        [openBibleChapter, openCustomDocument, openDocument, updateBibleTabsVersion],
    );
}

export function useShowOptions() {
    const showOptions = useAppStore((s) => s.showOptions);
    return showOptions;
}

export function useActiveTabTitle(): string | null {
    return useDocumentTabsStore(selectActiveTabTitle);
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
