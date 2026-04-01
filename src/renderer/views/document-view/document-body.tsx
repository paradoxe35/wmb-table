import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { Dropdown, Spin } from 'antd';
import type { MenuProps } from 'antd';
import {
    useSearchStore,
    useDocumentTabsStore,
    useAppStore,
    selectActiveTabKey,
} from '@renderer/stores';
import { DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import InlineSearchBar from '../components/inline-search-bar';

interface DocumentBodyProps {
    loading: boolean;
    ready: boolean;
    containerRef: React.RefObject<HTMLDivElement | null>;
    contextTargetRef: React.MutableRefObject<Element | null>;
    zoom: number;
    contextMenuItems: MenuProps['items'];
    header: React.ReactNode;
    children: React.ReactNode;
}

export default function DocumentBody({
    loading,
    ready,
    containerRef,
    contextTargetRef,
    zoom,
    contextMenuItems,
    header,
    children,
}: DocumentBodyProps) {
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const searchBarOpen = useSearchStore((s) =>
        activeTabKey ? (s.searchUiByTab[activeTabKey]?.searchBarOpen ?? false) : false,
    );
    const readingMode = useAppStore((s) => s.readingMode);

    // Preserve visible paragraph across reading mode toggles.
    // Ratio drifts due to line-wrapping changes; anchoring to a paragraph is exact.
    const anchorRef = useRef<{ index: string; offset: number } | null>(null);
    if (containerRef.current) {
        const el = containerRef.current;
        const containerTop = el.getBoundingClientRect().top;
        const paragraphs = el.querySelectorAll<HTMLElement>('[data-paragraph-index]');
        for (const p of paragraphs) {
            if (p.getBoundingClientRect().bottom > containerTop) {
                anchorRef.current = {
                    index: p.dataset.paragraphIndex!,
                    offset: p.getBoundingClientRect().top - containerTop,
                };
                break;
            }
        }
    }
    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el || !anchorRef.current) return;
        const target = el.querySelector<HTMLElement>(
            `[data-paragraph-index="${anchorRef.current.index}"]`,
        );
        if (target) {
            const containerTop = el.getBoundingClientRect().top;
            const targetTop = target.getBoundingClientRect().top;
            el.scrollTop += targetTop - containerTop - anchorRef.current.offset;
        }
        anchorRef.current = null;
    }, [readingMode]);

    const onContextMenu = useCallback(
        (e: React.MouseEvent) => {
            contextTargetRef.current = e.target as Element;
        },
        [contextTargetRef],
    );

    return (
        <div className={`mock-browser-content${readingMode ? ' reading-mode-content' : ''}`}>
            {loading && (
                <div className="flex flex-center" style={{ marginTop: '2rem' }}>
                    <Spin />
                </div>
            )}
            {!loading && ready && (
                <>
                    {header}
                    {searchBarOpen && <InlineSearchBar />}
                    <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
                        <div
                            ref={containerRef}
                            id={DOCUMENT_CONTAINER_ID}
                            className="sermon-body"
                            style={{ fontSize: `${1.2 * (zoom / 100)}em` }}
                            onContextMenu={onContextMenu}
                        >
                            {children}
                        </div>
                    </Dropdown>
                </>
            )}
        </div>
    );
}
