import React, { useCallback, useEffect } from 'react';
import { FundViewOutlined, ProfileOutlined } from '@ant-design/icons';
import { Menu } from 'antd';
import { appViewState, MAIN_VIEWS } from '../../store';
import { useRecoilState } from 'recoil';
import { ipcRenderer } from 'electron';
import { IPC_EVENTS } from '../../utils/ipc-events';
import { useValueStateRef } from '../../utils/hooks';

export default function ViewerMenu() {
  const [view, setView] = useRecoilState(appViewState);
  const viewRef = useValueStateRef(view);

  const m1 = useCallback(() => {
    setView(MAIN_VIEWS.options);
  }, []);

  const m2 = useCallback(() => {
    setView(MAIN_VIEWS.document);
  }, []);

  useEffect(() => {
    const switch_on_menu = () => {
      switch (viewRef.current) {
        case MAIN_VIEWS.options:
          setView(MAIN_VIEWS.document);
          break;
        case MAIN_VIEWS.document:
          setView(MAIN_VIEWS.options);
          break;
        default:
          break;
      }
    };
    ipcRenderer.on(IPC_EVENTS.switch_on_menu, switch_on_menu);
  }, []);

  return (
    <Menu
      theme="dark"
      mode="horizontal"
      className="row__center"
      selectedKeys={[view]}
    >
      <Menu.Item key={MAIN_VIEWS.options} onClick={m1}>
        <ProfileOutlined style={{ fontSize: '20px' }} />
      </Menu.Item>
      <Menu.Item key={MAIN_VIEWS.document} onClick={m2}>
        <FundViewOutlined style={{ fontSize: '20px' }} />
      </Menu.Item>
    </Menu>
  );
}
