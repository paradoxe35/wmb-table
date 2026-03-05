import { useCallback, useEffect, useRef, useState } from 'react';
import { Reorder } from 'framer-motion';
import { FileFilled, CloseOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useSermonStore, selectActiveTabTitle } from '@renderer/stores';
import { useTabPersistence } from '@renderer/hooks';
import type { DocumentTab } from '@shared/types';
import { CUSTOM_DOCUMENT_EVENT } from '@renderer/utils/events';

function TabItem({
    tab,
    isActive,
    onActivate,
    onRemove,
    style,
    contextMenuItems,
}: {
    tab: DocumentTab;
    isActive: boolean;
    onActivate: () => void;
    onRemove: () => void;
    style?: React.CSSProperties;
    contextMenuItems: MenuProps['items'];
}) {
    return (
        <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
            <Reorder.Item
                value={tab}
                as="div"
                className={`chrome-tab ${isActive ? 'chrome-tab--active' : ''}`}
                onClick={onActivate}
                onMouseDown={(e) => {
                    if (e.button === 1) {
                        e.preventDefault();
                        onRemove();
                    }
                }}
                style={style}
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
        </Dropdown>
    );
}

export default function DocumentTabs() {
    const tabs = useSermonStore((s) => s.tabs);
    const reorderTabs = useSermonStore((s) => s.reorderTabs);
    const activateTab = useSermonStore((s) => s.activateTab);
    const removeTab = useSermonStore((s) => s.removeTab);
    const removeOtherTabs = useSermonStore((s) => s.removeOtherTabs);
    const removeTabsToRight = useSermonStore((s) => s.removeTabsToRight);
    const removeAllTabs = useSermonStore((s) => s.removeAllTabs);
    const activeTitle = useSermonStore(selectActiveTabTitle);

    useTabPersistence(tabs);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Track container width
    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width ?? 0;
            setContainerWidth(w);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Check scroll overflow state
    const updateScrollState = useCallback(() => {
        const el = wrapperRef.current?.querySelector('.chrome-tabs') as HTMLElement | null;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 0);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }, []);

    useEffect(() => {
        updateScrollState();
    }, [tabs, containerWidth, updateScrollState]);

    useEffect(() => {
        const el = wrapperRef.current?.querySelector('.chrome-tabs') as HTMLElement | null;
        if (!el) return;
        el.addEventListener('scroll', updateScrollState);
        return () => el.removeEventListener('scroll', updateScrollState);
    }, [updateScrollState]);

    // Horizontal wheel scrolling
    useEffect(() => {
        const el = wrapperRef.current?.querySelector('.chrome-tabs') as HTMLElement | null;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

    // Auto-scroll to active tab
    useEffect(() => {
        if (!activeTitle) return;
        const el = wrapperRef.current?.querySelector('.chrome-tab--active') as HTMLElement | null;
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }, [activeTitle]);

    const scroll = useCallback((dir: 'left' | 'right') => {
        const el = wrapperRef.current?.querySelector('.chrome-tabs') as HTMLElement | null;
        if (!el) return;
        el.scrollBy({ left: dir === 'left' ? -150 : 150, behavior: 'smooth' });
    }, []);

    // Dynamic tab width
    const scrollBtnWidth = canScrollLeft || canScrollRight ? 48 : 0; // 24px per button
    const availableWidth = Math.max(0, containerWidth - scrollBtnWidth);
    const tabWidth =
        tabs.length > 0 ? Math.max(100, Math.min(180, availableWidth / tabs.length)) : 180;

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
        <div className="chrome-tabs-wrapper" ref={wrapperRef}>
            {canScrollLeft && (
                <button
                    className="tab-scroll-btn tab-scroll-btn--left"
                    onClick={() => scroll('left')}
                >
                    <LeftOutlined />
                </button>
            )}
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
                        style={{ width: tabWidth, maxWidth: tabWidth }}
                        contextMenuItems={getContextMenuItems(tab.title)}
                    />
                ))}
            </Reorder.Group>
            {canScrollRight && (
                <button
                    className="tab-scroll-btn tab-scroll-btn--right"
                    onClick={() => scroll('right')}
                >
                    <RightOutlined />
                </button>
            )}
            <div className="chrome-tabs-optional-shadow-below-bottom-bar"></div>
        </div>
    );
}
