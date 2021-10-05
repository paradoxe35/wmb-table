import { Button, Modal, Space } from 'antd';
import React, { useCallback, useState } from 'react';
import { useModalVisible } from '../../utils/hooks';
import { Typography } from 'antd';

export default function Updater() {
  const {
    showModal,
    isModalVisible,
    handleOk,
    handleCancel,
  } = useModalVisible();

  const [isDownloading, setIsDownloading] = useState(false);

  return (
    <>
      <Modal
        centered
        closable={false}
        keyboard={false}
        maskClosable={false}
        title={
          <>
            <Space direction="horizontal">
              <span>Mis à jour</span>
            </Space>
          </>
        }
        visible={isModalVisible}
        footer={[
          <Button disabled={isDownloading} key={0}>
            Fermer
          </Button>,
          <Button key={1} type="dashed">
            Télécharger
          </Button>,
        ]}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <UpdaterContent />
      </Modal>
    </>
  );
}

const UpdaterContent = () => {
  return <Typography></Typography>;
};
