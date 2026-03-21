import { useEffect, useRef } from 'react';
import DocumentTabs from '../../components/document-tabs';
import {
    useSermonStore,
    useSearchStore,
    useAppStore,
    selectActiveTab,
    selectActiveTabKey,
    selectActiveTabType,
} from '@renderer/stores';
import SermonDocumentView from './sermon-document-view';
import CustomDocumentView from './custom-document-view';
import BibleDocumentView from './bible-document-view';
import { HISTORY_EVENT } from '@renderer/utils/events';

export default function DocumentView() {
    const tabType = useSermonStore(selectActiveTabType);
    const activeTab = useSermonStore(selectActiveTab);
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const closeSearchBar = useSearchStore((s) => s.closeSearchBar);
    const searchBarOpen = useSearchStore((s) =>
        activeTabKey ? (s.searchUiByTab[activeTabKey]?.searchBarOpen ?? false) : false,
    );

    const tabs = useSermonStore((s) => s.tabs);
    const sermons = useSermonStore((s) => s.sermons);
    const addTab = useSermonStore((s) => s.addTab);

    useEffect(() => {
        if (tabs.length === 0 && sermons.length > 0) {
            addTab(sermons[0].title, sermons[0].sermonId);
        }
    }, [tabs.length, sermons, addTab]);

    // Record history when the active document changes (works for all document types)
    const prevTabKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (!contentLanguage || !activeTab || !activeTabKey) return;
        if (activeTabKey === prevTabKeyRef.current) return;
        prevTabKeyRef.current = activeTabKey;
        window.api.app
            .addHistoryEntry(
                contentLanguage,
                activeTab.title,
                activeTab.sermonId,
                activeTab.type ?? 'sermon',
            )
            .then(() => {
                window.dispatchEvent(new Event(HISTORY_EVENT.historyUpdated));
            });
    }, [activeTabKey, activeTab, contentLanguage]);

    const readingMode = useAppStore((s) => s.readingMode);
    const setReadingMode = useAppStore((s) => s.setReadingMode);
    const toggleReadingMode = useAppStore((s) => s.toggleReadingMode);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                toggleReadingMode();
            } else if (e.key === 'Escape' && readingMode) {
                e.preventDefault();
                setReadingMode(false);
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                if (activeTabKey) openSearchBar(activeTabKey);
            } else if (e.key === 'Escape' && searchBarOpen) {
                if (activeTabKey) closeSearchBar(activeTabKey);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [
        openSearchBar,
        closeSearchBar,
        searchBarOpen,
        activeTabKey,
        readingMode,
        setReadingMode,
        toggleReadingMode,
    ]);

    return (
        <div
            style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
        >
            <div style={{ display: readingMode ? 'none' : undefined }}>
                <DocumentTabs />
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {tabType === 'bible' ? (
                    <BibleDocumentView />
                ) : tabType === 'custom' ? (
                    <CustomDocumentView />
                ) : (
                    <SermonDocumentView />
                )}
            </div>
        </div>
    );
}
