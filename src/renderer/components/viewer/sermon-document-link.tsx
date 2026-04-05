import React from 'react';
import { useOpenDocumentRequest } from '@renderer/hooks';

const SermonDocumentLink: React.FC<{
    name: string;
    sermonId: string;
    translationId: number;
    languageCode: string;
    onItemClick?: () => void;
    children?: React.ReactNode;
}> = ({ children, name, sermonId, translationId, languageCode, onItemClick }) => {
    const openDocumentRequest = useOpenDocumentRequest();

    return (
        <span
            onClick={() => {
                onItemClick?.();
                openDocumentRequest({
                    title: name,
                    documentType: 'sermon',
                    sermonId,
                    translationId,
                    languageCode,
                });
            }}
        >
            {children}
        </span>
    );
};

export default SermonDocumentLink;
