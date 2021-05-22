import React from 'react';
import { FundViewOutlined, ProfileOutlined } from '@ant-design/icons';
import { Menu } from 'antd';

export default function ViewerMenu() {
  return (
    <Menu
      theme="dark"
      mode="horizontal"
      className="row__center"
      defaultSelectedKeys={['1']}
    >
      <Menu.Item key="1">
        <ProfileOutlined style={{ fontSize: '20px' }} />
      </Menu.Item>
      <Menu.Item key="2">
        <FundViewOutlined style={{ fontSize: '20px' }} />
      </Menu.Item>
    </Menu>
  );
}
