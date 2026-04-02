import React from 'react';
import { useOpenDocumentRequest } from '@renderer/hooks';
import type { SermonDocumentIdentity } from '@shared/types';

type DocumentViewTarget = Omit<SermonDocumentIdentity, 'documentType'> & {
    title: string;
    onItemClick?: () => void;
};

const DocumentViewer: React.FC<{
    name: string;
    sermonId: string;
    translationId: number;
    languageCode: string;
    onItemClick?: () => void;
    children?: React.ReactNode;
}> = ({ children, name, sermonId, translationId, languageCode, onItemClick }) => {
    const openDocumentRequest = useOpenDocumentRequest();

    const handleClick = ({
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

    return (
        <span
            onClick={() => {
                handleClick({
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
