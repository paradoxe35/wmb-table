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
        const id = sermonId ?? '';
        const resolvedTranslationId =
            translationId ?? (id ? sermonsById[id]?.translationId : undefined);
        if (!id || resolvedTranslationId == null) {
            return;
        }
        onItemClick?.();
        openDocument(name, id, resolvedTranslationId);
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
