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

interface AnchorSnapshot {
    index: string;
    offset: number;
}

function findAnchorSnapshot(
    container: HTMLDivElement,
    pendingParagraphIndex: number | null,
): AnchorSnapshot | null {
    const containerTop = container.getBoundingClientRect().top;

    const anchorParagraph =
        (pendingParagraphIndex != null
            ? container.querySelector<HTMLElement>(
                  `[data-paragraph-index="${pendingParagraphIndex}"]`,
              )
            : null) ??
        container.querySelector<HTMLElement>('.tts-active-paragraph[data-paragraph-index]') ??
        Array.from(container.querySelectorAll<HTMLElement>('[data-paragraph-index]')).find(
            (paragraph) => paragraph.getBoundingClientRect().bottom > containerTop,
        );

    if (!anchorParagraph?.dataset.paragraphIndex) {
        return null;
    }

    return {
        index: anchorParagraph.dataset.paragraphIndex,
        offset: anchorParagraph.getBoundingClientRect().top - containerTop,
    };
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
    const anchorRef = useRef<AnchorSnapshot | null>(null);
    const pendingParagraphIndex = getPendingNavigationParagraphIndex(
        pendingNavigation,
        documentIdentity,
    );

    useLayoutEffect(() => {
        const el = containerRef.current;
        const anchorSnapshot = anchorRef.current;

        if (el && anchorSnapshot) {
            const target = el.querySelector<HTMLElement>(
                `[data-paragraph-index="${anchorSnapshot.index}"]`,
            );
            if (target) {
                const containerTop = el.getBoundingClientRect().top;
                const targetTop = target.getBoundingClientRect().top;
                el.scrollTop += targetTop - containerTop - anchorSnapshot.offset;
            }
        }

        anchorRef.current = null;

        return () => {
            const currentContainer = containerRef.current;
            anchorRef.current = currentContainer
                ? findAnchorSnapshot(currentContainer, pendingParagraphIndex)
                : null;
        };
    }, [readingMode, zoom, pendingNavigation, documentIdentity, pendingParagraphIndex]);

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
