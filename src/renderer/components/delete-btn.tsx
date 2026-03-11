import { Button, Popconfirm, Tooltip } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export function DeleteBtn({ confirm, loading }: { confirm: () => void; loading?: boolean }) {
    const { t } = useTranslation();

    return (
        <Popconfirm
            title={t('Confirmer la suppression?')}
            onConfirm={() => confirm()}
            okText={t('Oui')}
            cancelText={t('Non')}
        >
            <Tooltip title={t('Supprimer')}>
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
