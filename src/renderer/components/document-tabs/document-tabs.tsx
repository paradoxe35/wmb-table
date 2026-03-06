import { useCallback, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import type { MenuProps } from 'antd';
import { useSermonStore, useAppStore, selectActiveTabTitle } from '@renderer/stores';
import { useTabPersistence } from '@renderer/hooks';
import { CUSTOM_DOCUMENT_EVENT } from '@renderer/utils/events';
import TabItem from './tab-item';

export default function DocumentTabs() {
    const tabs = useSermonStore((s) => s.tabs);
    const reorderTabs = useSermonStore((s) => s.reorderTabs);
    const activateTab = useSermonStore((s) => s.activateTab);
    const removeTab = useSermonStore((s) => s.removeTab);
    const removeOtherTabs = useSermonStore((s) => s.removeOtherTabs);
    const removeTabsToRight = useSermonStore((s) => s.removeTabsToRight);
    const removeAllTabs = useSermonStore((s) => s.removeAllTabs);
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const activeLanguage = useAppStore((s) => s.activeLanguage);

    useTabPersistence(tabs, activeLanguage);

    const getContextMenuItems = useCallback(
        (title: string): MenuProps['items'] => [
            { key: 'close', label: 'Fermer', onClick: () => removeTab(title) },
            {
                key: 'close-others',
                label: 'Fermer les autres',
                onClick: () => removeOtherTabs(title),
            },
            {
                key: 'close-right',
                label: 'Fermer à droite',
                onClick: () => removeTabsToRight(title),
            },
            { type: 'divider' },
            { key: 'close-all', label: 'Tout fermer', onClick: () => removeAllTabs() },
        ],
        [removeTab, removeOtherTabs, removeTabsToRight, removeAllTabs],
    );

    // Listen for custom document removal events
    useEffect(() => {
        const handleCustomDocRemoved = (e: Event) => {
            const detail = (e as CustomEvent)?.detail;
            if (detail?.title) {
                removeTab(detail.title);
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
    }, [removeTab]);

    return (
        <>
            <Reorder.Group
                axis="x"
                values={tabs}
                onReorder={reorderTabs}
                as="div"
                className="chrome-tabs"
            >
                {tabs.map((tab) => (
                    <TabItem
                        key={tab.title}
                        tab={tab}
                        isActive={tab.title === activeTitle}
                        onActivate={() => activateTab(tab.title)}
                        onRemove={() => removeTab(tab.title)}
                        contextMenuItems={getContextMenuItems(tab.title)}
                    />
                ))}
                <div className="chrome-tabs-bottom-bar" />
            </Reorder.Group>
            <div className="chrome-tabs-optional-shadow-below-bottom-bar" />
        </>
    );
}
