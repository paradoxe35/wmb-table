import { Button, Popconfirm, Tooltip } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

export function DeleteBtn({ confirm, loading }: { confirm: () => void; loading?: boolean }) {
    return (
        <Popconfirm
            title="Confirmer la suppression?"
            onConfirm={() => confirm()}
            okText="Oui"
            cancelText="Non"
        >
            <Tooltip title="Supprimer">
                <Button
                    shape="circle"
                    icon={<DeleteOutlined />}
                    loading={loading}
                    aria-label="Supprimer"
                />
            </Tooltip>
        </Popconfirm>
    );
}
