import React, { useCallback, useEffect, useRef } from 'react';
import { FundViewOutlined, ProfileOutlined } from '@ant-design/icons';
import { Menu } from 'antd';
import { appViewState, MAIN_VIEWS } from '../../store';
import { useRecoilState } from 'recoil';
import { IPC_EVENTS } from '../../utils/ipc-events';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';

export default function ViewerMenu() {
  const [view, setView] = useRecoilState(appViewState);
  const selectable = { [MAIN_VIEWS.document]: '2', [MAIN_VIEWS.options]: '1' };
  const firstLoad = useRef<string | null>(null);

  const m1 = useCallback(() => {
    setView(MAIN_VIEWS.options);
  }, []);

  const m2 = useCallback(() => {
    setView(MAIN_VIEWS.document);
  }, []);

  useEffect(() => {
    if (firstLoad.current) {
      sendIpcRequest<string>(IPC_EVENTS.menu_viewer, view);
    }
    firstLoad.current = view;
  }, [view]);

  return (
    <Menu
      theme="dark"
      mode="horizontal"
      className="row__center"
      selectedKeys={[selectable[view]]}
    >
      <Menu.Item key="1" onClick={m1}>
        <ProfileOutlined style={{ fontSize: '20px' }} />
      </Menu.Item>
      <Menu.Item key="2" onClick={m2}>
        <FundViewOutlined style={{ fontSize: '20px' }} />
      </Menu.Item>
    </Menu>
  );
}
