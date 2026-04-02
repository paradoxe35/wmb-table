import { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '@renderer/i18n';
import {
    useAppStore,
    clampTabsToLimit,
    useDocumentTabsStore,
    useSermonStore,
    selectActiveTabTitle,
} from '@renderer/stores';
import type { NewDocumentTab } from '@renderer/stores/document-tabs.store';
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
import { buildBibleDocumentId, formatDocumentTitle, getTabKey } from '@shared/types';

export { useContainerHeight } from './use-container-height';
export { useTabPersistence } from './use-tab-persistence';

export type OpenDocumentRequest = { title: string } & DocumentIdentity;

type PresentationSource =
    | DocumentIdentity
    | SubjectDocumentItem['documentReference']
    | NoteItemReference['documentReference'];

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

function getDocumentIdentityFromSource(source: PresentationSource): DocumentIdentity {
    if (!source) {
        throw new Error('Missing document source');
    }

    if ('documentType' in source) {
        return source;
    }

    return source.documentIdentity;
}

function resolveOpenRequestTitle(
    title: string,
    documentIdentity: DocumentIdentity,
    getSermonById: (sermonId: string) => SermonMetaWithTraductions | undefined,
): string {
    if (documentIdentity.documentType !== 'sermon') {
        return formatDocumentTitle(title, documentIdentity);
    }

    const sermon = getSermonById(documentIdentity.sermonId);
    const canonicalTitle =
        sermon?.translationId === documentIdentity.translationId &&
        sermon.languageCode === documentIdentity.languageCode
            ? sermon.title
            : title;

    return formatDocumentTitle(canonicalTitle, documentIdentity);
}

export function useDocumentPresentation() {
    const { getSermonById } = useSermonLookup();

    const resolveTitle = useCallback(
        (title: string, source: PresentationSource) =>
            resolveOpenRequestTitle(title, getDocumentIdentityFromSource(source), getSermonById),
        [getSermonById],
    );

    const buildOpenRequest = useCallback(
        (title: string, source: PresentationSource): OpenDocumentRequest => {
            const documentIdentity = getDocumentIdentityFromSource(source);
            return {
                title: resolveTitle(title, source),
                ...documentIdentity,
            };
        },
        [resolveTitle],
    );

    return {
        resolveTitle,
        buildOpenRequest,
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

function applyLanguageWorkspaceState(
    langCode: string,
    workspace: LanguageWorkspace,
    maxTabs: number,
): void {
    useAppStore.setState({
        contentLanguage: langCode,
        activeBibleVersion: workspace.activeBibleVersion,
    });
    useSermonStore.setState({ sermons: workspace.sermons });
    useDocumentTabsStore.setState({ tabs: clampTabsToLimit(workspace.tabs, maxTabs) });
}

export function useApplyLanguageWorkspace() {
    const maxTabs = useAppStore((s) => s.maxTabs);

    return useCallback(
        (langCode: string, workspace: LanguageWorkspace) => {
            applyLanguageWorkspaceState(langCode, workspace, maxTabs);
        },
        [maxTabs],
    );
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
    const setMaxTabs = useAppStore((s) => s.setMaxTabs);
    const setError = useAppStore((s) => s.setError);
    const uiLanguagePreference = useThemeStore((s) => s.uiLanguagePreference);
    const setUiLanguagePreference = useThemeStore((s) => s.setUiLanguagePreference);
    const applyLanguageWorkspace = useApplyLanguageWorkspace();

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
                setMaxTabs(maxTabs);

                // Sync UI language preference from DB (null = auto)
                const pref = dbUiLanguage ?? 'auto';
                if (pref !== uiLanguagePreference) {
                    setUiLanguagePreference(pref);
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
    }, [
        setError,
        setLoaded,
        setMaxTabs,
        setRememberReadingPosition,
        setSidebarHidden,
        setUiLanguagePreference,
        uiLanguagePreference,
        applyLanguageWorkspace,
    ]);
}

export function useAddDocumentTab() {
    const addTab = useDocumentTabsStore((s) => s.addTab);
    const maxTabs = useAppStore((s) => s.maxTabs);

    return useCallback(
        (tab: NewDocumentTab) => {
            addTab(tab, maxTabs);
        },
        [addTab, maxTabs],
    );
}

export function useOpenDocument() {
    const addTab = useAddDocumentTab();
    const setMainView = useAppStore((s) => s.setMainView);
    const updateTabScroll = useDocumentTabsStore((s) => s.updateTabScroll);

    return useCallback(
        (title: string, sermonId: string, translationId: number, languageCode: string) => {
            if (!languageCode) {
                return;
            }

            snapshotActiveDocumentScroll(updateTabScroll);
            addTab({
                title,
                documentId: sermonId,
                type: 'sermon',
                languageCode,
                translationId,
            });
            setMainView('document');
        },
        [addTab, setMainView, updateTabScroll],
    );
}

export type SermonOpenTarget = {
    title: string;
    sermonId: string;
    translationId: number;
    languageCode: string;
};

export function useOpenCustomDocument() {
    const addTab = useAddDocumentTab();
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
    const addTab = useAddDocumentTab();
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
    const setActiveBibleVersion = useAppStore((s) => s.setActiveBibleVersion);

    return useCallback(
        async (request: OpenDocumentRequest) => {
            if (request.documentType === 'custom') {
                openCustomDocument(request.title, request.customDocumentId);
                return;
            }

            if (request.documentType === 'bible') {
                await window.api.bible.switchVersion(request.bibleVersionAbbreviation);
                const v = await window.api.bible.getActiveVersion();
                setActiveBibleVersion(v);
                openBibleChapter(request);
                return;
            }

            openDocument(
                request.title,
                request.sermonId,
                request.translationId,
                request.languageCode,
            );
        },
        [openBibleChapter, openCustomDocument, openDocument, setActiveBibleVersion],
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
