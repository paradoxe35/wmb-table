import React, { useEffect, useState } from 'react';
import DocumentTabs from '../components/document-tabs';
import { Layout } from 'antd';
import { currentDocumentTabs } from '../store';
import { useRecoilValue } from 'recoil';
import sendIpcRequest from '../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../utils/ipc-events';
import { useContainerScrollY } from '../utils/hooks';

const { Content } = Layout;

export default function DocumentView() {
  const title = useRecoilValue(currentDocumentTabs);
  const [path, setPath] = useState<string | null>(null);

  const iframeRef = useContainerScrollY<HTMLIFrameElement>([window], 40, true);

  useEffect(() => {
    sendIpcRequest<string>(IPC_EVENTS.document_content_path, title).then((p) =>
      setPath(p)
    );
  }, [title]);

  const onIframeLoad = () => {
    // if (iframeRef.current) {
    //   iframeRef.current.contentDocument?.body.scrollIntoView({
    //     inline: 'center',
    //   });
    // }
    // resizeByHeiht(iframeRef, 85);
  };

  return (
    <>
      <DocumentTabs />
      <Content className="mock-browser-content">
        <iframe
          ref={iframeRef}
          hidden={!path}
          width="100%"
          onLoad={onIframeLoad}
          src={path || undefined}
          frameBorder="0"
        />
      </Content>
    </>
  );
}
