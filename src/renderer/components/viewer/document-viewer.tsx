import React from 'react';
import { useOpenDocument } from '@renderer/hooks';

export const useDocumentViewOpen = () => {
    const openDocument = useOpenDocument();

    const onClick = (name: string, onItemClick?: () => void) => {
        openDocument(name);
        onItemClick?.();
    };

    return onClick;
};

const DocumentViewer: React.FC<{
    name: string;
    id?: string;
    onItemClick?: () => void;
    children?: React.ReactNode;
}> = ({ children, name, onItemClick }) => {
    const viewDocument = useDocumentViewOpen();

    return <span onClick={() => viewDocument(name, onItemClick)}>{children}</span>;
};

export default DocumentViewer;
