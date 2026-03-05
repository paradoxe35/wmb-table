import { useEffect } from 'react';
import { Reorder } from 'framer-motion';
import { FileFilled, CloseOutlined } from '@ant-design/icons';
import { useSermonStore, selectActiveTabTitle } from '@renderer/stores';
import { useTabPersistence } from '@renderer/hooks';
import type { DocumentTab } from '@shared/types';
import { CUSTOM_DOCUMENT_EVENT } from '@renderer/utils/events';

function TabItem({
    tab,
    isActive,
    onActivate,
    onRemove,
}: {
    tab: DocumentTab;
    isActive: boolean;
    onActivate: () => void;
    onRemove: () => void;
}) {
    return (
        <Reorder.Item
            value={tab}
            as="div"
            className={`chrome-tab ${isActive ? 'chrome-tab--active' : ''}`}
            onClick={onActivate}
        >
            <FileFilled className="chrome-tab__icon" />
            <span className="chrome-tab__title" title={tab.title}>
                {tab.title}
            </span>
            <CloseOutlined
                className="chrome-tab__close"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
            />
        </Reorder.Item>
    );
}

export default function DocumentTabs() {
    const tabs = useSermonStore((s) => s.tabs);
    const reorderTabs = useSermonStore((s) => s.reorderTabs);
    const activateTab = useSermonStore((s) => s.activateTab);
    const removeTab = useSermonStore((s) => s.removeTab);
    const activeTitle = useSermonStore(selectActiveTabTitle);

    useTabPersistence(tabs);

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
        <div className="chrome-tabs-wrapper">
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
                    />
                ))}
            </Reorder.Group>
            <div className="chrome-tabs-optional-shadow-below-bottom-bar"></div>
        </div>
    );
}
