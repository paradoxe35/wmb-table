import React, { useEffect, useMemo } from 'react';
import {
  HistoryOutlined,
  GroupOutlined,
  SearchOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { Menu, Layout } from 'antd';
import OptionViewer from '../viewer/option-viewer';
import { OPTIONS_VIEWS, optionViewStore } from '../../store';
import { BibleIcons } from '../icons';
import { useRecoilValue } from 'recoil';
import { ipcRenderer } from 'electron';
import { IPC_EVENTS } from '../../utils/ipc-events';
import { useOptionsMenu, useValueStateRef } from '../../utils/hooks';

const { Sider } = Layout;

type Options = {
  key: string;
  name: string;
  icon: JSX.Element;
};

export default function SidebarMenu({ collapsed }: { collapsed: boolean }) {
  const optionViewer = useRecoilValue(optionViewStore);
  const optionViewerRef = useValueStateRef(optionViewer);
  const setOption = useOptionsMenu();

  const options: (Options | null)[] = useMemo(
    () => [
      {
        key: OPTIONS_VIEWS.history as string,
        name: 'Historique',
        icon: <HistoryOutlined />,
      },
      {
        key: OPTIONS_VIEWS.search as string,
        name: 'Recherche',
        icon: <SearchOutlined />,
      },
      {
        key: OPTIONS_VIEWS.subject as string,
        name: 'Sujets',
        icon: <GroupOutlined />,
      },
      {
        key: OPTIONS_VIEWS.editor as string,
        name: 'Notes',
        icon: <EditOutlined />,
      },
      null,
      {
        key: OPTIONS_VIEWS.bible as string,
        name: 'Bible',
        icon: <BibleIcons />,
      },
    ],
    []
  );

  useEffect(() => {
    const nOptions = options.filter((r) => r != null);
    const switch_on_options = () => {
      let index = nOptions.findIndex((v) => optionViewerRef.current == v?.key);
      index = index >= 0 && nOptions[index + 1] ? index + 1 : 0;
      setOption(nOptions[index]?.key as string);
    };
    ipcRenderer.on(IPC_EVENTS.switch_on_options, switch_on_options);
  }, []);

  return (
    <Sider
      trigger={null}
      className="layout__sidebar"
      theme="light"
      collapsible
      collapsed={collapsed}
    >
      <Menu mode="inline" selectedKeys={[optionViewer]}>
        {options.map((op, i) => {
          return op === null ? (
            <Menu.Divider key={i} />
          ) : (
            <Menu.Item key={op.key} icon={op.icon}>
              <OptionViewer component={op.key}>{op.name}</OptionViewer>
            </Menu.Item>
          );
        })}
      </Menu>
    </Sider>
  );
}
