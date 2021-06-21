import React, { useState } from 'react';
import { Layout, Space } from 'antd';

import ViewerMenu from './layout/viewer-menu';
import SidebarMenu from './layout/sidebar-menu';
import SidebarDocuments from './layout/sidebar-documents';
import { useContainerScrollY } from '../utils/hooks';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useRecoilValue } from 'recoil';
import { appDatasLoaded } from '../store';

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

const AppLayout: React.FC = ({ children }) => {
  const [collapsed, setCollapsed] = useState(true);

  const toggle = () => setCollapsed((c) => !c);

  const containerScroll = useContainerScrollY<HTMLDivElement>();

  return (
    <Layout>
      <Header className="header">
        <div className="logo" onClick={toggle}>
          <Title />
        </div>
        <ViewerMenu />
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
