import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { Dropdown, Spin } from 'antd';
import type { MenuProps } from 'antd';
import { getPendingNavigationParagraphIndex } from '@renderer/utils/pending-navigation';
import {
    useSearchStore,
    useDocumentTabsStore,
    useAppStore,
    selectActiveTabKey,
} from '@renderer/stores';
import type { DocumentIdentity } from '@shared/types';
import { DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import InlineSearchBar from '../components/inline-search-bar';

interface DocumentBodyProps {
    loading: boolean;
    ready: boolean;
    containerRef: React.RefObject<HTMLDivElement | null>;
    contextTargetRef: React.MutableRefObject<Element | null>;
    documentIdentity: DocumentIdentity | null;
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
    documentIdentity,
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
    const pendingNavigation = useDocumentTabsStore((s) => s.pendingNavigation);

    // Preserve the active TTS paragraph, or the first visible paragraph, across
    // layout shifts such as reading mode toggles and zoom changes.
    // When an explicit paragraph navigation is pending, anchor to that target
    // instead of the currently playing TTS paragraph.
    const anchorRef = useRef<{ index: string; offset: number } | null>(null);
    if (containerRef.current) {
        const el = containerRef.current;
        const containerTop = el.getBoundingClientRect().top;
        const pendingParagraphIndex = getPendingNavigationParagraphIndex(
            pendingNavigation,
            documentIdentity,
        );

        const anchorParagraph =
            (pendingParagraphIndex != null
                ? el.querySelector<HTMLElement>(`[data-paragraph-index="${pendingParagraphIndex}"]`)
                : null) ??
            el.querySelector<HTMLElement>('.tts-active-paragraph[data-paragraph-index]') ??
            Array.from(el.querySelectorAll<HTMLElement>('[data-paragraph-index]')).find(
                (p) => p.getBoundingClientRect().bottom > containerTop,
            );

        if (anchorParagraph?.dataset.paragraphIndex) {
            anchorRef.current = {
                index: anchorParagraph.dataset.paragraphIndex,
                offset: anchorParagraph.getBoundingClientRect().top - containerTop,
            };
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
    }, [readingMode, zoom, pendingNavigation, documentIdentity]);

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
