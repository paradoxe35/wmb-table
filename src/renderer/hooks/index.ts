import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore, useSermonStore, selectActiveTabTitle } from '@renderer/stores';
import { LANGUAGE_EVENT } from '@renderer/utils/events';
import type { SermonMetaWithTraductions } from '@shared/types';

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
    const setNeedsSetup = useAppStore((s) => s.setNeedsSetup);
    const setSidebarHidden = useAppStore((s) => s.setSidebarHidden);
    const setActiveLanguage = useAppStore((s) => s.setActiveLanguage);
    const setSermons = useSermonStore((s) => s.setSermons);
    const setTabs = useSermonStore((s) => s.setTabs);
    const needsSetup = useAppStore((s) => s.needsSetup);

    useEffect(() => {
        (async () => {
            try {
                // Check if any languages are installed
                const installed = await window.api.languages.getInstalled();
                if (installed.length === 0) {
                    setNeedsSetup(true);
                    setLoaded(true);
                    return;
                }

                const [langCode, sidebarStatus, tabs] = await Promise.all([
                    window.api.app.getActiveLanguage(),
                    window.api.app.getSidebarStatus(),
                    window.api.documents.getTabs(),
                ]);

                // Validate active language is still installed
                const validLang = installed.some((l) => l.code === langCode);
                if (!validLang) {
                    // Active language no longer exists — prompt user to manage languages
                    const fallback = installed[0].code;
                    await window.api.app.setActiveLanguage(fallback);
                    setActiveLanguage(fallback);
                    if (sidebarStatus) setSidebarHidden(sidebarStatus.hidden);
                    if (tabs?.length) setTabs(tabs);
                    const sermons = await window.api.documents.getTitles(fallback);
                    setSermons(sermons);
                    setTimeout(() => {
                        window.dispatchEvent(new Event(LANGUAGE_EVENT.openLanguageManager));
                    }, 500);
                    return;
                }

                setActiveLanguage(langCode);
                if (sidebarStatus) setSidebarHidden(sidebarStatus.hidden);
                if (tabs?.length) setTabs(tabs);

                const sermons = await window.api.documents.getTitles(langCode);
                setSermons(sermons);
            } finally {
                setLoaded(true);
            }
        })();
    }, [
        needsSetup,
        setLoaded,
        setNeedsSetup,
        setSidebarHidden,
        setActiveLanguage,
        setSermons,
        setTabs,
    ]);
}

export function useOpenDocument() {
    const addTab = useSermonStore((s) => s.addTab);
    const setMainView = useAppStore((s) => s.setMainView);

    return useCallback(
        (title: string) => {
            addTab(title);
            setMainView('document');
        },
        [addTab, setMainView],
    );
}

export function useOpenCustomDocument() {
    const addTab = useSermonStore((s) => s.addTab);
    const setMainView = useAppStore((s) => s.setMainView);

    return useCallback(
        (title: string) => {
            addTab(title, 'custom');
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
    const sermonsByTitle = useSermonStore((s) => s.sermonsByTitle);

    const getSermon = useCallback(
        (title: string): SermonMetaWithTraductions | undefined => sermonsByTitle[title],
        [sermonsByTitle],
    );

    return { sermonsByTitle, getSermon };
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
