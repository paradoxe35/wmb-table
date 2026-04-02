import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Reorder } from 'framer-motion';
import { App as AntApp, type MenuProps } from 'antd';
import {
    useDocumentTabsStore,
    useSearchStore,
    useAppStore,
    selectActiveTabKey,
} from '@renderer/stores';
import { useTtsStore } from '@renderer/stores/tts.store';
import { stopAllTtsPlayback } from '@renderer/services/tts-audio-player';
import { useTabPersistence } from '@renderer/hooks';
import { CUSTOM_DOCUMENT_EVENT, DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import { getTabKey } from '@shared/types';
import TabItem from './tab-item';

export default function DocumentTabs() {
    const { t } = useTranslation();
    const tabs = useDocumentTabsStore((s) => s.tabs);
    const reorderTabs = useDocumentTabsStore((s) => s.reorderTabs);
    const activateTab = useDocumentTabsStore((s) => s.activateTab);
    const removeTab = useDocumentTabsStore((s) => s.removeTab);
    const removeOtherTabs = useDocumentTabsStore((s) => s.removeOtherTabs);
    const removeTabsToRight = useDocumentTabsStore((s) => s.removeTabsToRight);
    const removeAllTabs = useDocumentTabsStore((s) => s.removeAllTabs);
    const updateTabScroll = useDocumentTabsStore((s) => s.updateTabScroll);
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const cleanupTabs = useSearchStore((s) => s.cleanupTabs);
    const resetTts = useTtsStore((s) => s.reset);
    const { modal } = AntApp.useApp();

    useTabPersistence(tabs, contentLanguage);

    const stopTtsIfPlaying = useCallback(
        (closedTabKey: string) => {
            const tts = useTtsStore.getState();
            if (tts.documentId === closedTabKey && tts.status !== 'idle') {
                stopAllTtsPlayback();
                resetTts();
            }
        },
        [resetTts],
    );

    // Close the active tab with Ctrl+W / Cmd+W (only when document view is active)
    const mainView = useAppStore((s) => s.mainView);
    useEffect(() => {
        if (mainView !== 'document') {
            return;
        }

        const handler = (e: KeyboardEvent) => {
            if (e.key === 'w' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                if (!activeTabKey) {
                    return;
                }

                const tab = tabs.find((t) => getTabKey(t) === activeTabKey);
                if (tab) {
                    stopTtsIfPlaying(activeTabKey);
                }

                cleanupTabs([activeTabKey]);
                removeTab(activeTabKey);
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [mainView, activeTabKey, tabs, removeTab, stopTtsIfPlaying, cleanupTabs]);

    const handleRemoveTab = useCallback(
        (key: string) => {
            const tab = tabs.find((t) => getTabKey(t) === key);
            if (tab) stopTtsIfPlaying(key);
            cleanupTabs([key]);
            removeTab(key);
        },
        [tabs, removeTab, stopTtsIfPlaying, cleanupTabs],
    );

    const handleRemoveOtherTabs = useCallback(
        (key: string) => {
            const removedKeys: string[] = [];
            for (const tab of tabs) {
                const tabKey = getTabKey(tab);
                if (tabKey !== key) {
                    stopTtsIfPlaying(tabKey);
                    removedKeys.push(tabKey);
                }
            }
            cleanupTabs(removedKeys);
            removeOtherTabs(key);
        },
        [tabs, removeOtherTabs, stopTtsIfPlaying, cleanupTabs],
    );

    const handleRemoveTabsToRight = useCallback(
        (key: string) => {
            const idx = tabs.findIndex((t) => getTabKey(t) === key);
            const removedKeys: string[] = [];
            for (const tab of tabs.slice(idx + 1)) {
                const tabKey = getTabKey(tab);
                stopTtsIfPlaying(tabKey);
                removedKeys.push(tabKey);
            }
            cleanupTabs(removedKeys);
            removeTabsToRight(key);
        },
        [tabs, removeTabsToRight, stopTtsIfPlaying, cleanupTabs],
    );

    const handleRemoveAllTabs = useCallback(() => {
        const allKeys = tabs.map((t) => getTabKey(t));
        for (const key of allKeys) stopTtsIfPlaying(key);
        cleanupTabs(allKeys);
        removeAllTabs();
    }, [tabs, removeAllTabs, stopTtsIfPlaying, cleanupTabs]);

    const confirmRemoveAll = useCallback(() => {
        modal.confirm({
            title: t('Fermer tous les onglets'),
            content: t('Voulez-vous vraiment fermer tous les onglets ?'),
            okText: t('Tout fermer'),
            cancelText: t('Annuler'),
            onOk: () => handleRemoveAllTabs(),
        });
    }, [modal, handleRemoveAllTabs]);

    const getContextMenuItems = useCallback(
        (key: string): MenuProps['items'] => [
            { key: 'close', label: t('Fermer'), onClick: () => handleRemoveTab(key) },
            {
                key: 'close-others',
                label: t('Fermer les autres'),
                onClick: () => handleRemoveOtherTabs(key),
            },
            {
                key: 'close-right',
                label: t('Fermer à droite'),
                onClick: () => handleRemoveTabsToRight(key),
            },
            { type: 'divider' },
            { key: 'close-all', label: t('Tout fermer'), onClick: () => confirmRemoveAll() },
        ],
        [handleRemoveTab, handleRemoveOtherTabs, handleRemoveTabsToRight, confirmRemoveAll],
    );

    // Listen for custom document removal events
    useEffect(() => {
        const handleCustomDocRemoved = (e: Event) => {
            const detail = (e as CustomEvent)?.detail;
            if (detail?.title) {
                handleRemoveTab(
                    getTabKey({
                        type: 'custom',
                        documentId: detail.id ?? '',
                    }),
                );
            }
        };

        window.addEventListener(
            CUSTOM_DOCUMENT_EVENT.customDocumentRemoved,
            handleCustomDocRemoved,
        );
        return () => {
            window.removeEventListener(
                CUSTOM_DOCUMENT_EVENT.customDocumentRemoved,
                handleCustomDocRemoved,
            );
        };
    }, [handleRemoveTab]);

    return (
        <>
            <Reorder.Group
                axis="x"
                values={tabs}
                onReorder={reorderTabs}
                as="div"
                className="chrome-tabs"
            >
                {tabs.map((tab) => {
                    const key = getTabKey(tab);
                    return (
                        <TabItem
                            key={key}
                            tab={tab}
                            isActive={key === activeTabKey}
                            onActivate={() => {
                                const container = document.getElementById(DOCUMENT_CONTAINER_ID);
                                if (activeTabKey && container) {
                                    const maxScroll = Math.max(
                                        0,
                                        container.scrollHeight - container.clientHeight,
                                    );
                                    const ratio =
                                        maxScroll === 0 ? 0 : container.scrollTop / maxScroll;
                                    updateTabScroll(activeTabKey, ratio);
                                }
                                activateTab(key);
                            }}
                            onRemove={() => handleRemoveTab(key)}
                            contextMenuItems={getContextMenuItems(key)}
                        />
                    );
                })}
                <div className="chrome-tabs-bottom-bar" />
            </Reorder.Group>
            <div className="chrome-tabs-optional-shadow-below-bottom-bar" />
        </>
    );
}
