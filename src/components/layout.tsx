import React, { useState } from 'react';
import { Layout } from 'antd';

import ViewerMenu from './layout/viewer-menu';
import SidebarMenu from './layout/sidebar-menu';
import SidebarDocuments from './layout/sidebar-documents';
import { useContainerScrollY } from '../utils/hooks';

const { Header, Content } = Layout;

const AppLayout: React.FC = ({ children }) => {
  const [collapsed, setCollapsed] = useState(true);

  const toggle = () => setCollapsed((c) => !c);

  const containerScroll = useContainerScrollY<HTMLDivElement>();

  return (
    <Layout>
      <Header className="header">
        <div className="logo" onClick={toggle}>
          Wmb Table
        </div>
        <ViewerMenu />
      </Header>
      <Layout>
        <SidebarMenu collapsed={collapsed} />
        <Layout>
          <div
            ref={containerScroll}
            className="site-layout-content"
            style={{ padding: '0 24px 24px' }}
          >
            <Content style={{ padding: 24 }}>{children}</Content>
          </div>
        </Layout>
        <SidebarDocuments />
      </Layout>
    </Layout>
  );
};

export default AppLayout;
