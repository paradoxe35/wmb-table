import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MenuProps } from 'antd';
import { App as AntApp, Dropdown } from 'antd';
import { useTranslation } from 'react-i18next';

function selectionIsInside(container: HTMLElement, selection: Selection): boolean {
    if (selection.rangeCount === 0) {
        return false;
    }

    const ancestor = selection.getRangeAt(0).commonAncestorContainer;
    const node = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : ancestor;
    return node instanceof Node && container.contains(node);
}

function getSelectedTextInContainer(container: HTMLElement): string {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? '';

    if (!selection || !text || !selectionIsInside(container, selection)) {
        return '';
    }

    return text;
}

export default function SelectableMessageContent({
    className,
    children,
}: {
    className: string;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    const { message } = AntApp.useApp();
    const contentRef = useRef<HTMLDivElement | null>(null);
    const [contextMenuOpen, setContextMenuOpen] = useState(false);
    const [selectedText, setSelectedText] = useState('');

    const closeContextMenu = useCallback(() => {
        setContextMenuOpen(false);
    }, []);

    const handleContextMenu = useCallback(() => {
        const container = contentRef.current;
        const text = container ? getSelectedTextInContainer(container) : '';

        if (!text) {
            setSelectedText('');
            closeContextMenu();
            return;
        }

        setSelectedText(text);
        setContextMenuOpen(true);
    }, [closeContextMenu]);

    const handleCopySelectedText = useCallback(async () => {
        if (!selectedText) {
            return;
        }

        try {
            await navigator.clipboard.writeText(selectedText);
            message.success(t('Texte copié'));
        } catch {
            message.error(t('Impossible de copier le texte.'));
        } finally {
            closeContextMenu();
        }
    }, [closeContextMenu, message, selectedText, t]);

    const menuItems = useMemo<MenuProps['items']>(
        () => [
            {
                key: 'copy-selection',
                label: t('Copier le texte sélectionné'),
                onClick: () => {
                    void handleCopySelectedText();
                },
            },
        ],
        [handleCopySelectedText, t],
    );

    return (
        <Dropdown
            menu={{ items: menuItems }}
            trigger={['contextMenu']}
            open={contextMenuOpen}
            onOpenChange={(open) => {
                if (!open) {
                    closeContextMenu();
                }
            }}
        >
            <div ref={contentRef} className={className} onContextMenu={handleContextMenu}>
                {children}
            </div>
        </Dropdown>
    );
}
