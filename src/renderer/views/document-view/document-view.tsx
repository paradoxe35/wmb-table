import { useEffect } from 'react';
import DocumentTabs from '../../components/document-tabs';
import {
    useSermonStore,
    useSearchStore,
    selectActiveTabKey,
    selectActiveTabType,
} from '@renderer/stores';
import SermonDocumentView from './sermon-document-view';
import CustomDocumentView from './custom-document-view';
import BibleDocumentView from './bible-document-view';

export default function DocumentView() {
    const tabType = useSermonStore(selectActiveTabType);
    const activeTabKey = useSermonStore(selectActiveTabKey);
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

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                if (activeTabKey) openSearchBar(activeTabKey);
            } else if (e.key === 'Escape' && searchBarOpen) {
                if (activeTabKey) closeSearchBar(activeTabKey);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [openSearchBar, closeSearchBar, searchBarOpen, activeTabKey]);

    return (
        <div
            style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
        >
            <DocumentTabs />
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
