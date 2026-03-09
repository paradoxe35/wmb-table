import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore, useSermonStore, selectActiveTabTitle } from '@renderer/stores';
import type { SermonMetaWithTraductions } from '@shared/types';
import { formatSermonDate } from '@renderer/utils/sermon-utils';
import { capitalize } from 'lodash';

export { useContainerHeight } from './use-container-height';
export { useTabPersistence } from './use-tab-persistence';

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
    const setActiveLanguage = useAppStore((s) => s.setActiveLanguage);
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

                const [langCode, sidebarStatus] = await Promise.all([
                    window.api.app.getActiveLanguage(),
                    window.api.app.getSidebarStatus(),
                ]);

                if (sidebarStatus) setSidebarHidden(sidebarStatus.hidden);

                // Validate active language is still installed
                const validLang = langCode && installed.some((l) => l.code === langCode);

                if (!validLang) {
                    // No persisted language or it was uninstalled — language modal will open
                    setLoaded(true);
                    return;
                }

                setActiveLanguage(langCode);
                const [sermons, savedTabs] = await Promise.all([
                    window.api.documents.getTitles(langCode),
                    window.api.documents.getTabs(langCode),
                ]);
                setSermons(sermons);
                if (savedTabs?.length) setTabs(savedTabs);
            } catch (err) {
                console.error('[useInitApp] Initialization failed:', err);
                setError("Erreur lors de l'initialisation de l'application");
            } finally {
                setLoaded(true);
            }
        })();
    }, [setLoaded, setSidebarHidden, setActiveLanguage, setSermons, setTabs, setError]);
}

export function useOpenDocument() {
    const addTab = useSermonStore((s) => s.addTab);
    const setMainView = useAppStore((s) => s.setMainView);

    return useCallback(
        (title: string, sermonId: string, translationId?: number) => {
            addTab(title, sermonId, 'sermon', undefined, translationId);
            setMainView('document');
        },
        [addTab, setMainView],
    );
}

export function useOpenCustomDocument() {
    const addTab = useSermonStore((s) => s.addTab);
    const setMainView = useAppStore((s) => s.setMainView);

    return useCallback(
        (title: string, sermonId: string) => {
            addTab(title, sermonId, 'custom');
            setMainView('document');
        },
        [addTab, setMainView],
    );
}

export function useOpenBibleChapter() {
    const addTab = useSermonStore((s) => s.addTab);
    const setMainView = useAppStore((s) => s.setMainView);

    return useCallback(
        (bookName: string, bookCode: string, chapter: string) => {
            const title = `${bookName} ${chapter}`;
            const sermonId = `${bookCode}:${chapter}`;
            addTab(title, sermonId, 'bible', undefined, undefined, bookCode, chapter);
            setMainView('document');
        },
        [addTab, setMainView],
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
    const activeLanguage = useAppStore((s) => s.activeLanguage);

    return useCallback(
        (dateMs: number) => capitalize(formatSermonDate(dateMs, activeLanguage ?? 'en')),
        [activeLanguage],
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
