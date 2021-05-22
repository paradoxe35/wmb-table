import React from 'react';
import {
  HistoryOutlined,
  GroupOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Menu, Layout } from 'antd';

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
      <Menu mode="inline" defaultSelectedKeys={['2']}>
        <Menu.Item key="2" icon={<HistoryOutlined />}>
          Historique
        </Menu.Item>
        <Menu.Item key="1" icon={<SearchOutlined />}>
          Recherche
        </Menu.Item>
        <Menu.Item key="3" icon={<GroupOutlined />}>
          Sujets
        </Menu.Item>
      </Menu>
    </Sider>
  );
}
