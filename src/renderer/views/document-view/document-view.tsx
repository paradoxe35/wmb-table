import { useEffect } from 'react';
import DocumentTabs from '../../components/document-tabs';
import {
    useSermonStore,
    useSearchStore,
    selectActiveTabTitle,
    selectActiveTabType,
} from '@renderer/stores';
import SermonDocumentView from './sermon-document-view';
import CustomDocumentView from './custom-document-view';

export default function DocumentView() {
    const tabType = useSermonStore(selectActiveTabType);
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const closeSearchBar = useSearchStore((s) => s.closeSearchBar);
    const searchBarOpen = useSearchStore((s) => s.searchBarOpen);
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const clearSearch = useSearchStore((s) => s.clearSearch);

    const tabs = useSermonStore((s) => s.tabs);
    const sermons = useSermonStore((s) => s.sermons);
    const addTab = useSermonStore((s) => s.addTab);

    useEffect(() => {
        if (tabs.length === 0 && sermons.length > 0) {
            addTab(sermons[0].title);
        }
    }, [tabs.length, sermons, addTab]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                openSearchBar();
            } else if (e.key === 'Escape' && searchBarOpen) {
                if (activeTitle) clearSearch(activeTitle);
                closeSearchBar();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [openSearchBar, closeSearchBar, searchBarOpen, activeTitle, clearSearch]);

    return (
        <div
            style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
        >
            <DocumentTabs />
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {tabType === 'custom' ? <CustomDocumentView /> : <SermonDocumentView />}
            </div>
        </div>
    );
}
