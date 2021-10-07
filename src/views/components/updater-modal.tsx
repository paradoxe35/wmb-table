import { Alert, Button, Modal, Progress, Space } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useModalVisible } from '../../utils/hooks';
import { Typography } from 'antd';
import { IPC_EVENTS } from '../../utils/ipc-events';
import { UpdaterNotification } from '../../types';
import { ipcRenderer } from 'electron';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';
import { secondsforHumans } from '../../utils/functions';

type ProgressType = {
  title: string;
  progress: { proceed?: number; total?: number; percent?: number };
  onlyPercent?: boolean;
};

const Icon = () => (
  <Space>
    <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />
    <span />
  </Space>
);
const ShowProgress = ({
  title,
  progress,
  onlyPercent = false,
}: ProgressType) => {
  const { percent, proceed, total } = progress;
  let rPercent: string | number = 0;
  if (onlyPercent && percent != undefined) {
    rPercent = percent.toFixed(0);
  } else if (proceed != undefined && total != undefined) {
    rPercent = ((proceed * 100) / total).toFixed(0);
  }
  return (
    <Space direction="vertical">
      <Space>
        <Typography.Text strong>{title}</Typography.Text>
        <Icon />
      </Space>
      <div style={{ width: 170 }}>
        <Progress percent={+rPercent} size="small" />
      </div>
    </Space>
  );
};

export default function Updater() {
  const { showModal, isModalVisible, handleCancel } = useModalVisible();

  const [updaterInfo, setUpdaterInfo] = useState<
    UpdaterNotification | undefined
  >(undefined);

  useEffect(() => {
    ipcRenderer.on(
      IPC_EVENTS.notify_for_new_update,
      (_: any, info: UpdaterNotification) => {
        setUpdaterInfo(info);
      }
    );

    ipcRenderer.on(IPC_EVENTS.app_update_menu, showModal);
  }, []);

  const start_download_update = useCallback(() => {
    sendIpcRequest(IPC_EVENTS.start_download_update);
  }, []);

  const quit_and_install_update = useCallback(() => {
    sendIpcRequest(IPC_EVENTS.quit_and_install_update);
  }, []);

  const restartAppNow = useCallback(() => {
    sendIpcRequest<boolean>(IPC_EVENTS.restart_app);
  }, []);

  const lastType = useRef<string | undefined>(undefined);

  useEffect(() => {
    lastType.current = updaterInfo?.type;
  }, [updaterInfo]);

  let preventActions = false;
  let content = <></>;
  let copyProgress = undefined;
  let nextStepAction:
    | undefined
    | {
        type: string;
        action: () => void;
      } = undefined;

  switch (updaterInfo?.type) {
    case 'hasUpdate':
      if (lastType.current != 'hasUpdate') {
        !isModalVisible && showModal();
      }
      preventActions = false;
      nextStepAction = {
        type: 'Mettre à jour',
        action: start_download_update,
      };
      content = (
        <Alert
          message="Mise à jour de l'application"
          description="Une nouvelle version est disponible. Cliquez sur le bouton ci-dessous pour démarrer le processus de mise à jour."
          type="info"
          showIcon
        />
      );
      break;
    case 'preparing':
      preventActions = true;
      copyProgress = updaterInfo.progress?.copyProgress;
      nextStepAction = undefined;
      content = (
        <>
          <Space direction="vertical">
            <ShowProgress
              title="Préparation de la mise à jour"
              progress={{
                proceed: copyProgress?.elapsedBytes,
                total: copyProgress?.totalBytes,
                percent: undefined,
              }}
              onlyPercent={false}
            />
            <Typography.Text type="secondary">
              Le processus sera terminé dans{' '}
              {secondsforHumans(copyProgress?.remainingSecs)}
            </Typography.Text>
          </Space>
        </>
      );
      break;
    case 'prepared':
      preventActions = true;
      nextStepAction = undefined;
      content = (
        <>
          <Alert
            message="Préparation de la mise à jour terminée"
            description="Début du téléchargement..."
            type="info"
            showIcon
            icon={<Icon />}
          />
        </>
      );
      break;
    case 'downloading':
      preventActions = true;
      nextStepAction = undefined;
      content = (
        <>
          <ShowProgress
            onlyPercent={true}
            title="Téléchargement du mise à jour"
            progress={{
              percent: updaterInfo.progress?.downloadProgress?.percent,
            }}
          />
        </>
      );
      break;
    case 'downloaded':
      preventActions = true;
      nextStepAction = {
        type: 'Installer la mise à jour',
        action: quit_and_install_update,
      };
      content = (
        <Alert
          message="Téléchargement terminé"
          description="Veuillez cliquer sur le bouton d'installation ci-dessous pour installer la mise à jour."
          type="success"
          showIcon
        />
      );
      break;
    case 'restartedToUpdate':
      if (lastType.current != 'restartedToUpdate') {
        !isModalVisible && showModal();
      }
      preventActions = true;
      nextStepAction = undefined;
      content = (
        <Alert
          message="L'installation mise à jour a été traitée avec succès"
          description="Veuillez patienter pendant que nous traitons la dernière étape."
          type="success"
          showIcon
          icon={<Icon />}
        />
      );
      break;
    case 'restoring':
      preventActions = true;
      copyProgress = updaterInfo.progress?.copyProgress;
      nextStepAction = undefined;
      content = (
        <>
          <Space direction="vertical">
            <ShowProgress
              title="Finalisation de la mise à jour"
              progress={{
                proceed: copyProgress?.elapsedBytes,
                total: copyProgress?.totalBytes,
              }}
            />
            <Typography.Text type="secondary">
              Le processus sera terminé dans{' '}
              {secondsforHumans(copyProgress?.remainingSecs)}
            </Typography.Text>
          </Space>
        </>
      );
      break;
    case 'restored':
      preventActions = true;
      nextStepAction = {
        type: "Redémarrer l'application maintenant",
        action: restartAppNow,
      };
      content = (
        <>
          <Alert
            message="Mise à jour terminée"
            description="Veuillez fermer et rouvrir l'application ou cliquer sur le bouton Redémarrer ci-dessous pour afficher les modifications apportées."
            type="success"
            showIcon
          />
        </>
      );
      break;
    case 'error':
      preventActions = false;
      nextStepAction = undefined;
      content = (
        <>
          <Alert
            message="Erreur !"
            description="Une erreur s'est produite lors de la mise à jour, veuillez réessayer plus tard."
            type="error"
            showIcon
          />
        </>
      );
      break;
    default:
      nextStepAction = undefined;
      preventActions = false;
      content = <></>;
      break;
  }

  return (
    <>
      <Modal
        centered
        closable={!preventActions}
        keyboard={!preventActions}
        maskClosable={!preventActions}
        title={
          <>
            <Space direction="horizontal">
              <span>Mise à jour</span>
            </Space>
          </>
        }
        visible={isModalVisible}
        footer={[
          <Button onClick={handleCancel} disabled={preventActions} key={0}>
            Fermer
          </Button>,
          <Button
            key={1}
            onClick={nextStepAction?.action}
            disabled={!nextStepAction}
            type="primary"
          >
            {!nextStepAction ? '---' : nextStepAction.type}
          </Button>,
        ]}
        onCancel={handleCancel}
      >
        {updaterInfo && (
          <Space direction="vertical">
            <Typography>
              <Typography.Paragraph>
                Version:{' '}
                {updaterInfo.status?.updateInfo?.version ||
                  updaterInfo.status?.version}
              </Typography.Paragraph>
              <Typography.Paragraph>
                Dernière vérification:{' '}
                {updaterInfo.status?.lastUpdateCheck?.toLocaleString()}
              </Typography.Paragraph>
            </Typography>
            {content}
          </Space>
        )}
      </Modal>
    </>
  );
}
