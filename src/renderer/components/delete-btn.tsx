import { Button, Popconfirm, Tooltip } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';

export function DeleteBtn({ confirm, loading }: { confirm: () => void; loading?: boolean }) {
    const { t } = useTranslation();
    const popRef = useRef(false);
    const [tooltipOpen, setTooltipOpen] = useState(false);

    return (
        <Popconfirm
            title={t('Confirmer la suppression?')}
            onConfirm={() => confirm()}
            onOpenChange={(open) => {
                popRef.current = open;
                if (open) {
                    setTooltipOpen(false);
                }
            }}
            okText={t('Oui')}
            cancelText={t('Non')}
        >
            <Tooltip
                title={t('Supprimer')}
                open={tooltipOpen}
                onOpenChange={(open) => {
                    if (!popRef.current) {
                        setTooltipOpen(open);
                    }
                }}
            >
                <Button
                    shape="circle"
                    icon={<DeleteOutlined />}
                    loading={loading}
                    aria-label={t('Supprimer')}
                />
            </Tooltip>
        </Popconfirm>
    );
}
