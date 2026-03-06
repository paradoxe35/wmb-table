import React from 'react';
import { useOpenDocument } from '@renderer/hooks';
import { useSermonStore } from '@renderer/stores';

export const useDocumentViewOpen = () => {
    const openDocument = useOpenDocument();
    const sermonsByTitle = useSermonStore((s) => s.sermonsByTitle);

    const onClick = (name: string, onItemClick?: () => void) => {
        const sermonDate = sermonsByTitle[name]?.sermonDate ?? '';
        openDocument(name, sermonDate);
        onItemClick?.();
    };

    return onClick;
};

const DocumentViewer: React.FC<{
    name: string;
    onItemClick?: () => void;
    children?: React.ReactNode;
}> = ({ children, name, onItemClick }) => {
    const viewDocument = useDocumentViewOpen();

    return <span onClick={() => viewDocument(name, onItemClick)}>{children}</span>;
};

export default DocumentViewer;
