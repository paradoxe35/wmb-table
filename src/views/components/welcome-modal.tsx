import { Button, Modal, Space } from 'antd';
import React, { useCallback } from 'react';
import { useEffect } from 'react';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';
import { useModalVisible } from '../../utils/hooks';
import { IPC_EVENTS } from '../../utils/ipc-events';
import { Avatar, Image } from 'antd';
import { getAssetPath } from '../../sys';
import { APP_NAME } from '../../utils/constants';
import { Typography } from 'antd';
import { useRecoilValue } from 'recoil';
import { documentTitlesStore } from '../../store';

const { Title, Paragraph, Link } = Typography;

export default function Welcome() {
  const {
    showModal,
    isModalVisible,
    handleOk,
    handleCancel,
  } = useModalVisible();

  useEffect(() => {
    sendIpcRequest<boolean>(IPC_EVENTS.initialized_app).then(
      (initialized) => !initialized && showModal()
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
        title={
          <>
            <Space direction="horizontal">
              <Avatar
                size="large"
                src={<Image src={getAssetPath('icon.png')} />}
              />
              <span>{APP_NAME}</span>
            </Space>
          </>
        }
        visible={isModalVisible}
        footer={[
          <Button onClick={handleCancel}>Commencer</Button>,
          <Button type="dashed" onClick={goToBackupModal}>
            Restaurer vos données
          </Button>,
          <Button type="primary">
            <Link
              style={{ color: '#fff', textDecoration: 'none' }}
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
            <Link href={process.env.DOCS_SUBJECT_LINK}>documentation</Link>).
          </li>
          <li>Créer des notes et les modifier.</li>
          <li>
            Ajoutez des références de documents ou de la Bible dans vos notes(
            <Link href={process.env.DOCS_NOTE_LINK}>documentation</Link>).
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
