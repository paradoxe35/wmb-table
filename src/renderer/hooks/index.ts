import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore, useSermonStore, selectActiveTabTitle } from '@renderer/stores';
import type {
    DocumentTab,
    InstalledLanguage,
    SermonMetaWithTraductions,
    SidebarStatus,
} from '@shared/types';

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
                const installed =
                    (await window.api.languages.getInstalled()) as InstalledLanguage[];
                if (installed.length === 0) {
                    setNeedsSetup(true);
                    setLoaded(true);
                    return;
                }

                const [langCode, sidebarStatus, tabs] = await Promise.all([
                    window.api.app.getActiveLanguage() as Promise<string>,
                    window.api.app.getSidebarStatus() as Promise<SidebarStatus | null>,
                    window.api.documents.getTabs() as Promise<DocumentTab[]>,
                ]);

                setActiveLanguage(langCode);
                if (sidebarStatus) setSidebarHidden(sidebarStatus.hidden);
                if (tabs?.length) setTabs(tabs);

                const sermons = (await window.api.documents.getTitles(
                    langCode,
                )) as SermonMetaWithTraductions[];
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
