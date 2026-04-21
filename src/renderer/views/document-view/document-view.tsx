import { useEffect, useRef } from 'react';
import DocumentTabs from '../../components/document-tabs';
import { useAddDocumentTab } from '@renderer/hooks';
import {
    useDocumentTabsStore,
    useSermonStore,
    useSearchStore,
    useAppStore,
    selectActiveTab,
    selectActiveDocumentIdentity,
    selectActiveTabKey,
    selectActiveTabType,
} from '@renderer/stores';
import SermonDocumentView from './sermon-document-view';
import CustomDocumentView from './custom-document-view';
import BibleDocumentView from './bible-document-view';
import SimilarSermonsModal from './similar-sermons-modal';
import { HISTORY_EVENT } from '@renderer/utils/events';
import { getDocumentIdentityKey } from '@shared/types';
import { useBibleTtsContinuation } from './bible-tts-continuation';

export default function DocumentView() {
    useBibleTtsContinuation();

    const tabType = useDocumentTabsStore(selectActiveTabType);
    const activeTab = useDocumentTabsStore(selectActiveTab);
    const activeDocumentIdentity = useDocumentTabsStore(selectActiveDocumentIdentity);
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const closeSearchBar = useSearchStore((s) => s.closeSearchBar);
    const searchBarOpen = useSearchStore((s) =>
        activeTabKey ? (s.searchUiByTab[activeTabKey]?.searchBarOpen ?? false) : false,
    );

    const tabCount = useDocumentTabsStore((s) => s.tabs.length);
    const firstSermon = useSermonStore((s) => s.sermons[0] ?? null);
    const addTab = useAddDocumentTab();

    useEffect(() => {
        if (tabCount === 0 && firstSermon) {
            addTab({
                title: firstSermon.title,
                documentId: firstSermon.sermonId,
                type: 'sermon',
                languageCode: firstSermon.languageCode,
                translationId: firstSermon.translationId,
            });
        }
    }, [tabCount, firstSermon, addTab]);

    // Record history when the active document changes (works for all document types)
    const prevHistorySignatureRef = useRef<string | null>(null);
    useEffect(() => {
        if (!contentLanguage || !activeTab || !activeDocumentIdentity) {
            return;
        }

        const documentIdentityKey = getDocumentIdentityKey(activeDocumentIdentity);
        const historySignature = `${documentIdentityKey}::${activeTab.title}`;
        if (historySignature === prevHistorySignatureRef.current) {
            return;
        }

        prevHistorySignatureRef.current = historySignature;

        window.api.app
            .addHistoryEntry(contentLanguage, {
                documentTitle: activeTab.title,
                documentIdentity: activeDocumentIdentity,
            })
            .then(() => {
                window.dispatchEvent(new Event(HISTORY_EVENT.historyUpdated));
            });
    }, [activeTab, activeDocumentIdentity, contentLanguage]);

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
            <SimilarSermonsModal />
        </div>
    );
}
