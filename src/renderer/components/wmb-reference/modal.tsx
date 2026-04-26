import { Button, Modal, Spin } from 'antd';
import { useTranslation } from 'react-i18next';

import { useWmbLinkNavigate } from '@renderer/hooks/use-wmb-link';

import { BibleReferenceView, DocReferenceView, SermonReferenceView } from './views';
import type { WmbReferenceData } from './resolvers';

export type WmbReferenceModalProps = {
    open: boolean;
    loading: boolean;
    data: WmbReferenceData | null;
    href: string | null;
    onClose: () => void;
};

function ReferenceBody({ loading, data }: { loading: boolean; data: WmbReferenceData | null }) {
    const { t } = useTranslation();

    if (loading || !data) {
        return (
            <div className="wmb-reference__loading">
                <Spin tip={t('Chargement de la référence…')} />
            </div>
        );
    }

    switch (data.type) {
        case 'sermon':
            return <SermonReferenceView data={data} />;
        case 'bible':
            return <BibleReferenceView data={data} />;
        case 'doc':
            return <DocReferenceView data={data} />;
    }
}

export function WmbReferenceModal({ open, loading, data, href, onClose }: WmbReferenceModalProps) {
    const { t } = useTranslation();
    const navigateWmbLink = useWmbLinkNavigate();

    const onOpenDocument = () => {
        if (href) navigateWmbLink(href);
        onClose();
    };

    const canOpen = href !== null && !loading && data !== null;

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
                <Button key="open" type="primary" onClick={onOpenDocument} disabled={!canOpen}>
                    {t('Ouvrir le document')}
                </Button>,
            ]}
        >
            <ReferenceBody loading={loading} data={data} />
        </Modal>
    );
}
