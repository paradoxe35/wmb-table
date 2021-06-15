import { Button, Popconfirm, Tooltip } from 'antd';
import React from 'react';
import { DeleteOutlined } from '@ant-design/icons';

export function DeleteBtn({ confirm }: { confirm: Function }) {
  return (
    <Popconfirm
      title="Êtes-vous sur ?"
      onConfirm={() => confirm()}
      okText="Oui"
      cancelText="Non"
    >
      <Tooltip title="Supprimer">
        <Button shape="circle" icon={<DeleteOutlined />} />
      </Tooltip>
    </Popconfirm>
  );
}
