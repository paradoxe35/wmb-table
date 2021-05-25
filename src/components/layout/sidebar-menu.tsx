import React from 'react';
import {
  HistoryOutlined,
  GroupOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Menu, Layout } from 'antd';
import OptionViewer from '../viewer/option-viewer';
import { OPTIONS_VIEWS } from '../../store';

const { Sider } = Layout;

export default function SidebarMenu({ collapsed }: { collapsed: boolean }) {
  return (
    <Sider
      trigger={null}
      className="layout__sidebar"
      theme="light"
      collapsible
      collapsed={collapsed}
    >
      <Menu mode="inline" defaultSelectedKeys={['1']}>
        <Menu.Item key="2" icon={<HistoryOutlined />}>
          <OptionViewer component={OPTIONS_VIEWS.history as string}>
            Historique
          </OptionViewer>
        </Menu.Item>
        <Menu.Item key="1" icon={<SearchOutlined />}>
          <OptionViewer component={OPTIONS_VIEWS.search as string}>
            Recherche
          </OptionViewer>
        </Menu.Item>
        <Menu.Item key="3" icon={<GroupOutlined />}>
          <OptionViewer component={OPTIONS_VIEWS.subject as string}>
            Sujets
          </OptionViewer>
        </Menu.Item>
      </Menu>
    </Sider>
  );
}
