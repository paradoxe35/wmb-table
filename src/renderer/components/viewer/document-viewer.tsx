import React from 'react';
import { useOpenDocumentRequest } from '@renderer/hooks';
import type { SermonDocumentIdentity } from '@shared/types';

type DocumentViewTarget = Omit<SermonDocumentIdentity, 'documentType'> & {
    title: string;
    onItemClick?: () => void;
};

export const useDocumentViewOpen = () => {
    const openDocumentRequest = useOpenDocumentRequest();

    const onClick = ({
        title,
        sermonId,
        translationId,
        languageCode,
        onItemClick,
    }: DocumentViewTarget) => {
        onItemClick?.();
        openDocumentRequest({
            title,
            documentType: 'sermon',
            sermonId,
            translationId,
            languageCode,
        });
    };

    return onClick;
};

const DocumentViewer: React.FC<{
    name: string;
    sermonId: string;
    translationId: number;
    languageCode: string;
    onItemClick?: () => void;
    children?: React.ReactNode;
}> = ({ children, name, sermonId, translationId, languageCode, onItemClick }) => {
    const viewDocument = useDocumentViewOpen();

    return (
        <span
            onClick={() => {
                viewDocument({
                    title: name,
                    sermonId,
                    translationId,
                    languageCode,
                    onItemClick,
                });
            }}
        >
            {children}
        </span>
    );
};

export default DocumentViewer;
