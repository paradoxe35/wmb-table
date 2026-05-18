import React, { useCallback, useState } from 'react';
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
import { useScrollLock } from '@renderer/hooks/use-scroll-lock';
import { useDocumentParagraphAnchor } from './hooks/use-document-paragraph-anchor';

const CONTEXT_PARAGRAPH_CLASS = 'sermon-paragraph--context-target';

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
    const [contextMenuOpen, setContextMenuOpen] = useState(false);

    useScrollLock(containerRef, contextMenuOpen);

    const pendingParagraphIndex = getPendingNavigationParagraphIndex(
        pendingNavigation,
        documentIdentity,
    );

    useDocumentParagraphAnchor({
        containerRef,
        documentIdentity,
        pendingParagraphIndex,
        readingMode,
        ready,
        zoom,
    });

    const clearContextParagraph = useCallback(() => {
        containerRef.current
            ?.querySelector(`.${CONTEXT_PARAGRAPH_CLASS}`)
            ?.classList.remove(CONTEXT_PARAGRAPH_CLASS);
    }, [containerRef]);

    const handleContextMenuOpenChange = useCallback(
        (open: boolean) => {
            setContextMenuOpen(open);
            if (!open) {
                clearContextParagraph();
            }
        },
        [clearContextParagraph],
    );

    const onContextMenu = useCallback(
        (e: React.MouseEvent) => {
            contextTargetRef.current = e.target as Element;
            clearContextParagraph();
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed) {
                return;
            }
            (e.target as Element)
                .closest('[data-paragraph-index]')
                ?.classList.add(CONTEXT_PARAGRAPH_CLASS);
        },
        [clearContextParagraph, contextTargetRef],
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
                    <Dropdown
                        menu={{ items: contextMenuItems }}
                        trigger={['contextMenu']}
                        open={contextMenuOpen}
                        onOpenChange={handleContextMenuOpenChange}
                    >
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
