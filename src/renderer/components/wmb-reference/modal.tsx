import { Button, Modal, Spin } from 'antd';
import { useTranslation } from 'react-i18next';

import { BibleReferenceView, DocReferenceView, SermonReferenceView } from './views';
import type { ReferenceContent } from './content';

export type WmbReferenceModalProps = {
    open: boolean;
    loading: boolean;
    content: ReferenceContent | null;
    onOpen: (() => void) | null;
    onClose: () => void;
};

function ReferenceBody({
    loading,
    content,
}: {
    loading: boolean;
    content: ReferenceContent | null;
}) {
    const { t } = useTranslation();

    if (loading || !content) {
        return (
            <div className="wmb-reference__loading">
                <Spin tip={t('Chargement de la référence…')} />
            </div>
        );
    }

    switch (content.type) {
        case 'sermon':
            return <SermonReferenceView content={content} />;
        case 'bible':
            return <BibleReferenceView content={content} />;
        case 'doc':
            return <DocReferenceView content={content} />;
    }
}

export function WmbReferenceModal({
    open,
    loading,
    content,
    onOpen,
    onClose,
}: WmbReferenceModalProps) {
    const { t } = useTranslation();

    const handleOpen = () => {
        onOpen?.();
        onClose();
    };

    const canOpen = onOpen !== null && !loading && content !== null;

    return (
        <Modal
            open={open}
            onCancel={onClose}
            destroyOnHidden
            title={null}
            footer={[
                <Button key="close" onClick={onClose}>
                    {t('Fermer')}
                </Button>,
                <Button key="open" type="primary" onClick={handleOpen} disabled={!canOpen}>
                    {t('Ouvrir le document')}
                </Button>,
            ]}
        >
            <ReferenceBody loading={loading} content={content} />
        </Modal>
    );
}
