import { Button, Modal, Space, message, Progress } from 'antd';
import { ipcRenderer } from 'electron';
import React, { useCallback, useMemo, useState } from 'react';
import { useEffect } from 'react';
import { useModalVisible } from '../../utils/hooks';
import { IPC_EVENTS } from '../../utils/ipc-events';
import { Typography } from 'antd';
import { BackupStatus, RestoreProgressEvent } from '../../types';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

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
  const [fetchedStatus, setFetchStatus] = useState(false);

  useEffect(() => {
    ipcRenderer.on(IPC_EVENTS.open_backup_modal_from_main, showModal);
    window.addEventListener(IPC_EVENTS.open_backup_modal_from_main, showModal);
    sendIpcRequest<boolean>(IPC_EVENTS.backup_reminder).then(
      (canOpen) => canOpen && showModal()
    );
  }, []);

  useEffect(() => {
    updateStatus(
      sendIpcRequest<BackupStatus>(IPC_EVENTS.backup_status)
    ).finally(() => setFetchStatus(true));

    ipcRenderer.on(IPC_EVENTS.backup_status, (_: any, status: BackupStatus) => {
      if (status) setActiveBackup(status);
    });
  }, []);

  const updateStatus = useCallback(
    (peddingRequest: Promise<BackupStatus | null>) => {
      return peddingRequest.then((status) => {
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
            onClick={
              activeBackup
                ? handleBackupStatus
                : fetchedStatus
                ? handleLogin
                : undefined
            }
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
  const [restoreProgress, setRestoreProgress] = useState<
    RestoreProgressEvent
  >();

  useEffect(() => {
    ipcRenderer.on(
      IPC_EVENTS.backup_progression,
      (_: any, data: RestoreProgressEvent) => setRestoreProgress(data)
    );
  }, []);

  const restoreContentType = useMemo(() => {
    if (!restoreProgress) return null;
    const {
      progression: { proceed, total },
    } = restoreProgress;
    const progress = (
      <Text>
        <Space>
          <span>{restoreProgress.type}: </span>
          <div style={{ width: 170 }}>
            <Progress percent={(proceed * 100) / total} size="small" />
          </div>
        </Space>
      </Text>
    );
    return {
      start: <Text>Début de la récupération des données</Text>,
      complete: (
        <Text type="success">Vos données ont été restaurées avec succès</Text>
      ),
      error: (
        <Text type="danger">
          Une erreur s'est produite lors de la restauration, veuillez réessayer
          plus tard
        </Text>
      ),
      prepare: <Text>Préparation de la restauration des données</Text>,
      progress: progress,
      sauvegarde: progress,
    } as { [x: string]: JSX.Element };
  }, [restoreProgress]);

  const restoreContent = useMemo(() => {
    if (!restoreContentType || !restoreProgress) return null;
    for (const key in restoreContentType) {
      if (restoreProgress.type.includes(key)) {
        return restoreContentType[key];
      }
    }
    return null;
  }, [restoreContentType]);

  return (
    <Typography>
      <Paragraph>Email: {status.email}</Paragraph>
      <Paragraph>Stockage: {'Google Drive'}</Paragraph>
      <Paragraph>
        Dernière mise à jour: {status.lastUpdate.toLocaleTimeString('fr')}
      </Paragraph>
      {restoreContent && restoreProgress && (
        <Paragraph>
          <Space direction="vertical">
            <Space direction="horizontal">
              <Text strong>
                {restoreProgress.type === 'sauvegarde'
                  ? 'Sauvegarde'
                  : 'Restauration'}{' '}
                de données
              </Text>
              <Spin
                indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />}
              />
            </Space>
            {restoreContent}
          </Space>
        </Paragraph>
      )}
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
