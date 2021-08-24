import { Button, Modal, Space } from 'antd';
import { ipcRenderer } from 'electron';
import React, { useState } from 'react';
import { useEffect } from 'react';
import { useModalVisible } from '../../utils/hooks';
import { IPC_EVENTS } from '../../utils/ipc-events';
import { Typography } from 'antd';

const { Paragraph } = Typography;

export default function BackupProfile() {
  const {
    showModal,
    isModalVisible,
    handleOk,
    handleCancel,
  } = useModalVisible();

  const [activeBackup, setActiveBackup] = useState(undefined);

  useEffect(() => {
    ipcRenderer.on(IPC_EVENTS.open_backup_modal_from_main, showModal);
    window.addEventListener(IPC_EVENTS.open_backup_modal_from_main, showModal);
  }, []);

  return (
    <>
      <Modal
        title={
          <>
            <Space direction="horizontal">
              <span>Sauvegarde</span>
            </Space>
          </>
        }
        visible={isModalVisible}
        footer={[
          <Button onClick={handleCancel}>
            {activeBackup ? 'Fermer' : 'Plus Tard'}
          </Button>,
          <Button type="dashed" onClick={undefined}>
            Restaurer vos données
          </Button>,
        ]}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <BackupContent />
      </Modal>
    </>
  );
}

const BackupContent = () => {
  return (
    <Typography>
      <Paragraph>
        Pour activer le système de sauvegarde, vous devez vous connecter à votre
        compte Google.
      </Paragraph>
      <Paragraph strong>
        Après la connexion, vos dernières données sauvegardées seront restaurées
        automatiquement et vos prochaines sauvegardes se feront automatiquement.
      </Paragraph>
    </Typography>
  );
};
