import React from 'react';
import { useOpenDocument } from '@renderer/hooks';
import { useSermonStore } from '@renderer/stores';

export const useDocumentViewOpen = () => {
    const openDocument = useOpenDocument();
    const sermonsById = useSermonStore((s) => s.sermonsById);

    const onClick = (
        name: string,
        onItemClick?: () => void,
        sermonId?: string,
        translationId?: number,
    ) => {
        const id = sermonId ?? sermonsById[name]?.sermonId ?? '';
        onItemClick?.();
        openDocument(name, id, translationId);
    };

    return onClick;
};

const DocumentViewer: React.FC<{
    name: string;
    sermonId?: string;
    translationId?: number;
    onItemClick?: () => void;
    children?: React.ReactNode;
}> = ({ children, name, sermonId, translationId, onItemClick }) => {
    const viewDocument = useDocumentViewOpen();

    return (
        <span onClick={() => viewDocument(name, onItemClick, sermonId, translationId)}>
            {children}
        </span>
    );
};

export default DocumentViewer;
