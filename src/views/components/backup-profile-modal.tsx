import { Button, Modal, Space, message } from 'antd';
import { ipcRenderer } from 'electron';
import React, { useCallback, useState } from 'react';
import { useEffect } from 'react';
import { useModalVisible } from '../../utils/hooks';
import { IPC_EVENTS } from '../../utils/ipc-events';
import { Typography } from 'antd';
import { BackupStatus } from '../../types';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';

const { Paragraph } = Typography;

export default function BackupProfile() {
  const {
    showModal,
    isModalVisible,
    handleOk,
    handleCancel,
  } = useModalVisible();

  const [activeBackup, setActiveBackup] = useState<BackupStatus | undefined>(
    undefined
  );

  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    ipcRenderer.on(IPC_EVENTS.open_backup_modal_from_main, showModal);
    window.addEventListener(IPC_EVENTS.open_backup_modal_from_main, showModal);
    sendIpcRequest<boolean>(IPC_EVENTS.backup_reminder).then(
      (canOpen) => canOpen && showModal()
    );
  }, []);

  useEffect(() => {
    updateStatus(sendIpcRequest<BackupStatus>(IPC_EVENTS.backup_status));

    ipcRenderer.on(IPC_EVENTS.backup_status, (_: any, status: BackupStatus) => {
      if (status) setActiveBackup(status);
    });
  }, []);

  const updateStatus = useCallback(
    (peddingRequest: Promise<BackupStatus | null>) => {
      peddingRequest.then((status) => {
        if (status) setActiveBackup(status);
      });
    },
    []
  );

  const handleLogin = useCallback(() => {
    setLoading(true);
    const showError = (error: string) => {
      switch (error) {
        case 'network':
          message.warn('Vous êtes hors ligne');
          break;
        default:
          message.error(
            "Une erreur s'est produite lors de la connexion, réessayez plus tard"
          );
          break;
      }
    };
    const pedding = sendIpcRequest<any>(IPC_EVENTS.backup_login)
      .then((res: BackupStatus & { error: string }) => {
        if (res.error) {
          showError(res.error);
          return false;
        }
        return res;
      })
      .finally(() => setLoading(false));
    updateStatus(pedding as Promise<BackupStatus>);
  }, []);

  const handleBackupStatus = useCallback(() => {
    updateStatus(sendIpcRequest<BackupStatus>(IPC_EVENTS.backup_status_put));
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
          <Button key={0} onClick={handleCancel}>
            {activeBackup ? 'Fermer' : 'Plus tard'}
          </Button>,
          <Button
            key={1}
            loading={loading}
            type="primary"
            onClick={activeBackup ? handleBackupStatus : handleLogin}
          >
            {activeBackup
              ? activeBackup.active
                ? 'Pause'
                : 'Reprendre'
              : 'Connexion'}
          </Button>,
        ]}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        {activeBackup ? (
          <ActiveBackup activeBackup={activeBackup} />
        ) : (
          <BackupContent />
        )}
      </Modal>
    </>
  );
}

const ActiveBackup = ({
  activeBackup: status,
}: {
  activeBackup: BackupStatus;
}) => {
  return (
    <Typography>
      <Paragraph>Email: {status.email}</Paragraph>
      <Paragraph>Stockage: {'Google Drive'}</Paragraph>
      <Paragraph>
        Dernière mise à jour: {status.lastUpdate.toLocaleTimeString('fr')}
      </Paragraph>
    </Typography>
  );
};

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
