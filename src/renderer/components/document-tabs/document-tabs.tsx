import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Reorder } from 'framer-motion';
import { App as AntApp, type MenuProps } from 'antd';
import { useSermonStore, useAppStore, selectActiveTabKey } from '@renderer/stores';
import { useTtsStore } from '@renderer/stores/tts.store';
import { stopAllTtsPlayback } from '@renderer/services/tts-audio-player';
import { useTabPersistence } from '@renderer/hooks';
import { CUSTOM_DOCUMENT_EVENT, DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import { getTabKey } from '@shared/types';
import TabItem from './tab-item';

export default function DocumentTabs() {
    const { t } = useTranslation();
    const tabs = useSermonStore((s) => s.tabs);
    const reorderTabs = useSermonStore((s) => s.reorderTabs);
    const activateTab = useSermonStore((s) => s.activateTab);
    const removeTab = useSermonStore((s) => s.removeTab);
    const removeOtherTabs = useSermonStore((s) => s.removeOtherTabs);
    const removeTabsToRight = useSermonStore((s) => s.removeTabsToRight);
    const removeAllTabs = useSermonStore((s) => s.removeAllTabs);
    const updateTabScroll = useSermonStore((s) => s.updateTabScroll);
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const { modal } = AntApp.useApp();

    useTabPersistence(tabs, activeLanguage);

    const stopTtsIfPlaying = useCallback((closedTabTitle: string) => {
        const tts = useTtsStore.getState();
        if (tts.documentId === closedTabTitle && tts.status !== 'idle') {
            stopAllTtsPlayback();
            tts.reset();
        }
    }, []);

    const handleRemoveTab = useCallback(
        (key: string) => {
            const tab = tabs.find((t) => getTabKey(t) === key);
            if (tab) stopTtsIfPlaying(tab.title);
            removeTab(key);
        },
        [tabs, removeTab, stopTtsIfPlaying],
    );

    const handleRemoveOtherTabs = useCallback(
        (key: string) => {
            for (const tab of tabs) {
                if (getTabKey(tab) !== key) stopTtsIfPlaying(tab.title);
            }
            removeOtherTabs(key);
        },
        [tabs, removeOtherTabs, stopTtsIfPlaying],
    );

    const handleRemoveTabsToRight = useCallback(
        (key: string) => {
            const idx = tabs.findIndex((t) => getTabKey(t) === key);
            for (const tab of tabs.slice(idx + 1)) {
                stopTtsIfPlaying(tab.title);
            }
            removeTabsToRight(key);
        },
        [tabs, removeTabsToRight, stopTtsIfPlaying],
    );

    const handleRemoveAllTabs = useCallback(() => {
        for (const tab of tabs) stopTtsIfPlaying(tab.title);
        removeAllTabs();
    }, [tabs, removeAllTabs, stopTtsIfPlaying]);

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
                    getTabKey({ title: detail.title, sermonId: detail.sermonId ?? '' }),
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
                                const currentActive = tabs.find(
                                    (t) => getTabKey(t) === activeTabKey,
                                );
                                const container = document.getElementById(DOCUMENT_CONTAINER_ID);
                                if (currentActive && container) {
                                    updateTabScroll(activeTabKey!, container.scrollTop);
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
