import React from 'react';
import {
    type SermonOpenTarget,
    useDocumentPresentation,
    useOpenDocumentRequest,
} from '@renderer/hooks';
import { buildSermonDocumentIdentity } from '@shared/types';

export const useDocumentViewOpen = () => {
    const { buildOpenRequest } = useDocumentPresentation();
    const openDocumentRequest = useOpenDocumentRequest();

    const onClick = ({
        title,
        sermonId,
        translationId,
        languageCode,
        onItemClick,
    }: SermonOpenTarget & { onItemClick?: () => void }) => {
        onItemClick?.();
        openDocumentRequest(
            buildOpenRequest(
                title,
                buildSermonDocumentIdentity(sermonId, translationId, languageCode),
            ),
        );
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
            onClick={() =>
                viewDocument({
                    title: name,
                    sermonId,
                    translationId,
                    languageCode,
                    onItemClick,
                })
            }
        >
            {children}
        </span>
    );
};

export default DocumentViewer;
