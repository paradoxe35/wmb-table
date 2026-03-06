import React from 'react';
import { useOpenDocument } from '@renderer/hooks';
import { useSermonStore } from '@renderer/stores';

export const useDocumentViewOpen = () => {
    const openDocument = useOpenDocument();
    const sermonsById = useSermonStore((s) => s.sermonsById);

    const onClick = (name: string, onItemClick?: () => void, sermonId?: string) => {
        const id = sermonId ?? sermonsById[name]?.sermonId ?? '';
        openDocument(name, id);
        onItemClick?.();
    };

    return onClick;
};

const DocumentViewer: React.FC<{
    name: string;
    sermonId?: string;
    onItemClick?: () => void;
    children?: React.ReactNode;
}> = ({ children, name, sermonId, onItemClick }) => {
    const viewDocument = useDocumentViewOpen();

    return <span onClick={() => viewDocument(name, onItemClick, sermonId)}>{children}</span>;
};

export default DocumentViewer;
