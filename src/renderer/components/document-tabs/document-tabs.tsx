import { useCallback, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import { App as AntApp, type MenuProps } from 'antd';
import { useSermonStore, useAppStore, selectActiveTabKey } from '@renderer/stores';
import { useTabPersistence } from '@renderer/hooks';
import { CUSTOM_DOCUMENT_EVENT } from '@renderer/utils/events';
import { getTabKey } from '@shared/types';
import TabItem from './tab-item';

export default function DocumentTabs() {
    const tabs = useSermonStore((s) => s.tabs);
    const reorderTabs = useSermonStore((s) => s.reorderTabs);
    const activateTab = useSermonStore((s) => s.activateTab);
    const removeTab = useSermonStore((s) => s.removeTab);
    const removeOtherTabs = useSermonStore((s) => s.removeOtherTabs);
    const removeTabsToRight = useSermonStore((s) => s.removeTabsToRight);
    const removeAllTabs = useSermonStore((s) => s.removeAllTabs);
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const { modal } = AntApp.useApp();

    useTabPersistence(tabs, activeLanguage);

    const confirmRemoveAll = useCallback(() => {
        modal.confirm({
            title: 'Fermer tous les onglets',
            content: 'Voulez-vous vraiment fermer tous les onglets ?',
            okText: 'Tout fermer',
            cancelText: 'Annuler',
            onOk: () => removeAllTabs(),
        });
    }, [modal, removeAllTabs]);

    const getContextMenuItems = useCallback(
        (key: string): MenuProps['items'] => [
            { key: 'close', label: 'Fermer', onClick: () => removeTab(key) },
            {
                key: 'close-others',
                label: 'Fermer les autres',
                onClick: () => removeOtherTabs(key),
            },
            {
                key: 'close-right',
                label: 'Fermer à droite',
                onClick: () => removeTabsToRight(key),
            },
            { type: 'divider' },
            { key: 'close-all', label: 'Tout fermer', onClick: () => confirmRemoveAll() },
        ],
        [removeTab, removeOtherTabs, removeTabsToRight, confirmRemoveAll],
    );

    // Listen for custom document removal events
    useEffect(() => {
        const handleCustomDocRemoved = (e: Event) => {
            const detail = (e as CustomEvent)?.detail;
            if (detail?.title) {
                removeTab(getTabKey({ title: detail.title, sermonId: detail.sermonId ?? '' }));
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
                {tabs.map((tab) => {
                    const key = getTabKey(tab);
                    return (
                        <TabItem
                            key={key}
                            tab={tab}
                            isActive={key === activeTabKey}
                            onActivate={() => activateTab(key)}
                            onRemove={() => removeTab(key)}
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
