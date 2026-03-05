import React from 'react';
import { useOpenCustomDocument } from '@renderer/hooks';

export const useDocumentViewOpen = () => {
    const openCustomDocument = useOpenCustomDocument();

    const onClick = (name: string, onItemClick?: () => void) => {
        openCustomDocument(name);
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
