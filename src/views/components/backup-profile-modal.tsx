import { Modal, Space } from 'antd';
import { ipcRenderer } from 'electron';
import React from 'react';
import { useEffect } from 'react';
import { useModalVisible } from '../../utils/hooks';
import { IPC_EVENTS } from '../../utils/ipc-events';

export default function BackupProfile() {
  const {
    showModal,
    isModalVisible,
    handleOk,
    handleCancel,
  } = useModalVisible();

  useEffect(() => {
    ipcRenderer.on(IPC_EVENTS.open_backup_modal_from_main, showModal);
    window.addEventListener(IPC_EVENTS.open_backup_modal_from_main, showModal);
  }, []);

  return (
    <>
      <Modal
        width="50%"
        title={
          <>
            <Space direction="horizontal">
              <span>Documents</span>
            </Space>
          </>
        }
        visible={isModalVisible}
        footer={[]}
        onOk={handleOk}
        onCancel={handleCancel}
      ></Modal>
    </>
  );
}
