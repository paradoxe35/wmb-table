import { Button, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

export function DeleteBtn({ confirm }: { confirm: () => void }) {
    return (
        <Popconfirm
            title="Confirmer la suppression?"
            onConfirm={() => confirm()}
            okText="Oui"
            cancelText="Non"
        >
            {/* <Tooltip title="Supprimer"> */}
            <Button shape="circle" icon={<DeleteOutlined />} />
            {/* </Tooltip> */}
        </Popconfirm>
    );
}
