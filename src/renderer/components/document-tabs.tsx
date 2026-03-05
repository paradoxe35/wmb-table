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
            className={`chrome-tab-item ${isActive ? 'active' : ''}`}
            onClick={onActivate}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                cursor: 'pointer',
                userSelect: 'none',
                borderBottom: isActive ? '2px solid #1890ff' : '2px solid transparent',
                background: isActive ? '#f0f5ff' : 'transparent',
                borderRadius: '4px 4px 0 0',
                whiteSpace: 'nowrap',
                maxWidth: 180,
                minWidth: 0,
            }}
        >
            <FileFilled style={{ fontSize: 12, flexShrink: 0 }} />
            <span
                style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: 12,
                }}
                title={tab.title}
            >
                {tab.title}
            </span>
            <CloseOutlined
                style={{ fontSize: 10, flexShrink: 0, marginLeft: 'auto' }}
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
                style={{ display: 'flex', overflow: 'hidden' }}
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
