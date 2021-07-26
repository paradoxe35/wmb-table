import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Layout, Space } from 'antd';

import ViewerMenu from './layout/viewer-menu';
import SidebarMenu from './layout/sidebar-menu';
import SidebarDocuments from './layout/sidebar-documents';
import { useContainerScrollY } from '../utils/hooks';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useRecoilState, useRecoilValue } from 'recoil';
import { appDatasLoaded, sidebarStatusHidden } from '../store';

import { LeftCircleOutlined, RightCircleOutlined } from '@ant-design/icons';
import sendIpcRequest from '../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../utils/ipc-events';
import { SidebarStatus } from '../types';

const { Header, Content } = Layout;

function Title() {
  const appLoaded = useRecoilValue(appDatasLoaded);

  return (
    <Space direction="horizontal">
      <span>Wmb Table</span>
      {!appLoaded && (
        <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />
      )}
    </Space>
  );
}

const SidebarStatusHanlder = () => {
  const [hidden, setHidden] = useRecoilState(sidebarStatusHidden);
  const statusRef = useRef<SidebarStatus | null>(null);

  useEffect(() => {
    sendIpcRequest<SidebarStatus>(IPC_EVENTS.sidebar_status).then((status) => {
      statusRef.current = status;
      setHidden(status.hidden);
    });
  }, []);

  const toggleCollapsed = useCallback(() => {
    if (statusRef.current) {
      statusRef.current.hidden = !statusRef.current.hidden;
      setHidden(statusRef.current.hidden);
      sendIpcRequest<boolean>(
        IPC_EVENTS.sidebar_status_set,
        statusRef.current._id,
        statusRef.current.hidden
      );
    }
  }, []);

  return (
    <Button type="link" onClick={toggleCollapsed}>
      {hidden ? (
        <LeftCircleOutlined style={{ fontSize: '1.2em' }} />
      ) : (
        <RightCircleOutlined style={{ fontSize: '1.2em' }} />
      )}
    </Button>
  );
};

const AppLayout: React.FC = ({ children }) => {
  const [collapsed, setCollapsed] = useState(true);

  const toggle = () => setCollapsed((c) => !c);

  const containerScroll = useContainerScrollY<HTMLDivElement>();

  return (
    <Layout>
      <Header className="app-header">
        <div className="logo" onClick={toggle}>
          <Title />
        </div>
        <ViewerMenu />
        <div className="logo">
          <SidebarStatusHanlder />
        </div>
      </Header>
      <Layout>
        <SidebarMenu collapsed={collapsed} />
        <Layout>
          <div ref={containerScroll} className="site-layout-content">
            <Content style={{ padding: 24, paddingBottom: 0 }}>
              {children}
            </Content>
          </div>
        </Layout>
        <SidebarDocuments />
      </Layout>
    </Layout>
  );
};

export default AppLayout;
