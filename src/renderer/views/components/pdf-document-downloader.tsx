import { Title } from '@localtypes/index';
import { CHILD_PARENT_WINDOW_EVENT } from '@modules/shared/shared';
import { ipcRenderer } from 'electron';
import sendIpcRequest from '@root/ipc/ipc-renderer';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { message, notification, Progress, Space } from 'antd';

const DownloadProgressStatus = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = (_: any, progres: number | null) => {
      if (typeof progres === 'number') {
        setProgress(+progres.toFixed(0));
      }
    };
    ipcRenderer.on(IPC_EVENTS.download_document_pdf_progress, handler);
    return () => {
      ipcRenderer.off(IPC_EVENTS.download_document_pdf_progress, handler);
    };
  }, []);

  return (
    <Space align="center">
      <Progress
        strokeColor={{
          '0%': '#108ee9',
          '100%': '#87d068',
        }}
        status="active"
        percent={progress}
      />
    </Space>
  );
};

export default function PdfDocumentDownloader() {
  const documentRef = useRef<Title>();
  const downloading = useRef<boolean>(false);

  // open  notification about download progress
  const openNotification = useCallback(() => {
    notification.open({
      key: documentRef.current?.title,
      message: 'Téléchargement en cours',
      description: <DownloadProgressStatus />,
      duration: 0,
    });
  }, []);

  // download handler after event has been emitted
  const downloadHandler = useCallback((event: CustomEventInit<Title>) => {
    // prevent start twoo download process
    if (downloading.current) return;

    // send download event to main thread
    documentRef.current = event.detail;
    sendIpcRequest<boolean | null>(
      IPC_EVENTS.download_document_pdf,
      event.detail
    ).then((res) => {
      if (res === false) {
        message.warn('La connexion Internet est requise');
      } else if (res === true) {
        openNotification();
      }
    });
  }, []);

  // listener when click on pdf donwload button from document child view
  useEffect(() => {
    window.addEventListener(
      CHILD_PARENT_WINDOW_EVENT.downloadDocumentPdf,
      downloadHandler
    );
    return () => {
      window.removeEventListener(
        CHILD_PARENT_WINDOW_EVENT.downloadDocumentPdf,
        downloadHandler
      );
    };
  }, []);

  // listener donwload progress
  useEffect(() => {
    ipcRenderer.on(
      IPC_EVENTS.download_document_pdf_progress,
      (_: any, progress: number | null) => {
        if (progress === null) {
          window.setTimeout(() => {
            notification.destroy();
            message.success('Enregistré');
          }, 1000);
          downloading.current = false;
        } else {
          downloading.current = true;
        }
      }
    );
  }, []);

  return <></>;
}
