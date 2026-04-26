import { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '@renderer/i18n';
import {
    useAppStore,
    clampTabsToLimit,
    useDocumentTabsStore,
    useSermonStore,
    useSermonsById,
    useSearchStore,
} from '@renderer/stores';
import type { NewDocumentTab } from '@renderer/stores/document-tabs.store';
import { useThemeStore } from '@renderer/stores/theme.store';
import { useTtsStore } from '@renderer/stores/tts.store';
import { stopAllTtsPlayback } from '@renderer/services/tts-audio-player';
import { DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import type {
    BibleVersionInfo,
    DocumentReference,
    DocumentIdentity,
    DocumentTab,
    NoteItemReference,
    SermonListItemWithTranslations,
    SubjectDocumentItem,
} from '@shared/types';
import { formatSermonDate, formatSermonDateShort } from '@renderer/utils/sermon-utils';
import { capitalize } from 'lodash';
import {
    buildBibleDocumentId,
    formatDocumentTitle,
    getDocumentIdentityFromTab,
    getDocumentIdentityKey,
    getTabKey,
} from '@shared/types';
import { resolveUiLanguage } from '@shared/constants';

export { useContainerHeight } from './use-container-height';
export { useTabPersistence } from './use-tab-persistence';

export type OpenDocumentRequest = { title: string } & DocumentIdentity;

type PresentationSource =
    | DocumentIdentity
    | SubjectDocumentItem['documentReference']
    | NoteItemReference['documentReference'];

type LanguageWorkspace = {
    sermons: SermonListItemWithTranslations[];
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

function snapshotActiveDocumentScroll(
    updateTabScroll: (key: string, scrollY?: number) => void,
    rememberReadingPosition: boolean,
) {
    if (!rememberReadingPosition) {
        return;
    }

    const currentTab = useDocumentTabsStore.getState().tabs.find((tab) => tab.active);
    const container = document.getElementById(DOCUMENT_CONTAINER_ID);
    if (!currentTab || !container) return;

    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const scrollRatio = maxScroll === 0 ? 0 : container.scrollTop / maxScroll;
    updateTabScroll(getTabKey(currentTab), scrollRatio);
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
    getSermonById: (sermonId: string) => SermonListItemWithTranslations | undefined,
): string {
    if (documentIdentity.documentType !== 'sermon') {
        return formatDocumentTitle(title, documentIdentity);
    }

    const sermon = getSermonById(documentIdentity.sermonId);
    const matchingTranslation = sermon?.availableTranslations.find(
        (translation) =>
            translation.translationId === documentIdentity.translationId &&
            translation.languageCode === documentIdentity.languageCode,
    );

    const canonicalTitle =
        matchingTranslation?.title ??
        (sermon?.translationId === documentIdentity.translationId &&
        sermon.languageCode === documentIdentity.languageCode
            ? sermon.title
            : title);

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
    useSermonStore.getState().setSermons(workspace.sermons);
    useDocumentTabsStore.setState({
        tabs: clampTabsToLimit(workspace.tabs, maxTabs),
        hydrated: true,
    });
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
    const setUiLanguagePreference = useThemeStore((s) => s.setUiLanguagePreference);
    const applyLanguageWorkspace = useApplyLanguageWorkspace();

    useEffect(() => {
        (async () => {
            try {
                const installed = await window.api.languages.getInstalled({ includeStats: false });

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
                if (pref !== useThemeStore.getState().uiLanguagePreference) {
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

export function useOpenDocumentRequest() {
    const addTab = useAddDocumentTab();
    const setMainView = useAppStore((s) => s.setMainView);
    const updateTabScroll = useDocumentTabsStore((s) => s.updateTabScroll);
    const rememberReadingPosition = useAppStore((s) => s.rememberReadingPosition);

    return useCallback(
        async (request: OpenDocumentRequest) => {
            if (request.documentType === 'custom') {
                snapshotActiveDocumentScroll(updateTabScroll, rememberReadingPosition);
                addTab({
                    title: request.title,
                    documentId: request.customDocumentId,
                    type: 'custom',
                });
                setMainView('document');
                return;
            }

            if (request.documentType === 'bible') {
                snapshotActiveDocumentScroll(updateTabScroll, rememberReadingPosition);
                addTab({
                    title: request.title,
                    documentId: buildBibleDocumentId(request.bibleBook, request.bibleChapter),
                    type: 'bible',
                    bibleBook: request.bibleBook,
                    bibleChapter: request.bibleChapter,
                    bibleVersionAbbreviation: request.bibleVersionAbbreviation,
                });
                setMainView('document');
                return;
            }

            snapshotActiveDocumentScroll(updateTabScroll, rememberReadingPosition);
            addTab({
                title: request.title,
                documentId: request.sermonId,
                type: 'sermon',
                languageCode: request.languageCode,
                translationId: request.translationId,
            });
            setMainView('document');
        },
        [addTab, rememberReadingPosition, setMainView, updateTabScroll],
    );
}

export function usePrepareTabIdentityChange() {
    const cleanupTabs = useSearchStore((s) => s.cleanupTabs);
    const resetTts = useTtsStore((s) => s.reset);
    const ttsDocumentKey = useTtsStore((s) => s.documentKey);
    const ttsStatus = useTtsStore((s) => s.status);

    return useCallback(
        (tabKey: string, options?: { stopTts?: boolean }) => {
            cleanupTabs([tabKey]);

            const tab = useDocumentTabsStore
                .getState()
                .tabs.find((candidate) => getTabKey(candidate) === tabKey);
            const tabDocumentKey = tab
                ? getDocumentIdentityKey(getDocumentIdentityFromTab(tab))
                : null;

            if (
                options?.stopTts &&
                tabDocumentKey != null &&
                ttsDocumentKey === tabDocumentKey &&
                ttsStatus !== 'idle'
            ) {
                stopAllTtsPlayback();
                resetTts();
            }
        },
        [cleanupTabs, resetTts, ttsDocumentKey, ttsStatus],
    );
}

export function useShowOptions() {
    const showOptions = useAppStore((s) => s.showOptions);
    return showOptions;
}

export function useSermonLookup() {
    const sermonsById = useSermonsById();

    const getSermonById = useCallback(
        (sermonId: string): SermonListItemWithTranslations | undefined => sermonsById[sermonId],
        [sermonsById],
    );

    return { sermonsById, getSermonById };
}

export function useFormatSermonDate(languageOverride?: string | null) {
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const locale = languageOverride ?? contentLanguage ?? 'en';

    return useCallback((dateMs: number) => capitalize(formatSermonDate(dateMs, locale)), [locale]);
}

export function useFormatSermonDateShort(languageOverride?: string | null) {
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const locale = languageOverride ?? contentLanguage ?? 'en';

    return useCallback((dateMs: number) => formatSermonDateShort(dateMs, locale), [locale]);
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

export const useResolvedUiLanguage = () => {
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const uiLanguagePreference = useThemeStore((s) => s.uiLanguagePreference);
    const uiLanguage = resolveUiLanguage(uiLanguagePreference, contentLanguage);

    return uiLanguage;
};
