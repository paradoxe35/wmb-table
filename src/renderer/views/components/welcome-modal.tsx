import { Button, Modal, Space } from 'antd';
import React, { useCallback, useState } from 'react';
import { useEffect } from 'react';
import sendIpcRequest from '@root/ipc/ipc-renderer';
import { useModalVisible } from '@renderer/hooks';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import { Avatar } from 'antd';
import { APP_NAME } from '@root/utils/constants';
import { Typography } from 'antd';
import { useRecoilValue } from 'recoil';
import { documentTitlesStore } from '@renderer/store';

const { Title, Paragraph, Link } = Typography;

export default function Welcome() {
  const {
    showModal,
    isModalVisible,
    handleOk,
    handleCancel,
  } = useModalVisible();

  const [image, setImage] = useState<undefined | string>(undefined);

  useEffect(() => {
    sendIpcRequest<{ started_to_update: boolean }>(
      IPC_EVENTS.started_to_update
    ).then((status) => {
      if (!status.started_to_update) {
        sendIpcRequest<boolean>(IPC_EVENTS.initialized_app).then(
          (initialized) => !initialized && showModal()
        );
      }
    });
    sendIpcRequest<string>(IPC_EVENTS.get_asset, 'icon.png').then((path) =>
      setImage(path)
    );
  }, []);

  const goToBackupModal = useCallback(() => {
    handleCancel();
    window.dispatchEvent(new Event(IPC_EVENTS.open_backup_modal_from_main));
  }, []);

  return (
    <>
      <Modal
        centered
        width="60%"
        title={
          <>
            <Space direction="horizontal">
              <Avatar size="large" src={image} />
              <span>{APP_NAME}</span>
            </Space>
          </>
        }
        visible={isModalVisible}
        footer={[
          <Button key={0} onClick={handleCancel}>
            Commencer
          </Button>,
          <Button key={1} type="dashed" onClick={goToBackupModal}>
            Restaurer vos données
          </Button>,
          <Button key={2} type="primary">
            <Link
              style={{ color: '#fff', textDecoration: 'none' }}
              target="_blank"
              href={process.env.DOCS_LINK}
            >
              Documentation
            </Link>
          </Button>,
        ]}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <WelcomeContent />
      </Modal>
    </>
  );
}

const WelcomeContent = () => {
  const titles = useRecoilValue(documentTitlesStore);

  return (
    <Typography>
      <Title>Bienvenue à {APP_NAME}</Title>
      <Paragraph>Voici quelques fonctionnalités prises en charge: </Paragraph>
      <Paragraph>
        <ul>
          <li>{titles.length} sermons déjà enregistrés et regroupés par an.</li>
          <li>
            Recherchez des mots ou des phrases dans tous les documents avec des
            résultats pertinents.
          </li>
          <li>Ajouter de nouveaux documents.</li>
          <li>
            Regroupez vos références de documents par sujet(pour plus d'infos,
            allez dans la{' '}
            <Link target="_blank" href={process.env.DOCS_SUBJECT_LINK}>
              documentation
            </Link>
            ).
          </li>
          <li>Créer des notes et les modifier.</li>
          <li>
            Ajoutez des références de documents ou de la Bible dans vos notes(
            <Link target="_blank" href={process.env.DOCS_NOTE_LINK}>
              documentation
            </Link>
            ).
          </li>
          <li>Bible (Louis Segond)</li>
          <li>
            Sauvegarde automatique de vos paramètres et données sur Internet
            pour les restaurer ultérieurement.
          </li>
          <li>Etc.</li>
        </ul>
      </Paragraph>
    </Typography>
  );
};
