import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    HistoryOutlined,
    GroupOutlined,
    SearchOutlined,
    EditOutlined,
    RobotOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import { Menu, Layout } from 'antd';
import type { MenuProps } from 'antd';
import { useAppStore } from '@renderer/stores';
import { BibleIcons } from '../icons';
import AudioDocumentPlayerIndicator from '../audio-document-player-indicator';

const { Sider } = Layout;

type OptionDef = { key: string; name: string; icon: React.ReactNode };

const mainOptions: OptionDef[] = [
    { key: 'history', name: 'Historique', icon: <HistoryOutlined /> },
    { key: 'search', name: 'Recherche', icon: <SearchOutlined /> },
    { key: 'subject', name: 'Sujets', icon: <GroupOutlined /> },
    { key: 'editor', name: 'Notes', icon: <EditOutlined /> },
];

const secondaryOptions: OptionDef[] = [{ key: 'bible', name: 'Bible', icon: <BibleIcons /> }];

const bottomOptions: OptionDef[] = [
    { key: 'settings', name: 'Paramètres', icon: <SettingOutlined /> },
];

// Options that participate in Ctrl+Shift+Tab cycling (exclude settings)
const cyclableOptions = [...mainOptions, ...secondaryOptions];

export default function SidebarMenu({
    collapsed,
    onCollapse,
}: {
    collapsed: boolean;
    onCollapse?: (collapsed: boolean) => void;
}) {
    const { t } = useTranslation();
    const optionView = useAppStore((s) => s.optionView);
    const showOptions = useAppStore((s) => s.showOptions);
    const [aiEnabled, setAiEnabled] = React.useState(false);
    const optionViewRef = useRef(optionView);
    optionViewRef.current = optionView;

    const toItem = useCallback(
        (op: OptionDef) => ({
            key: op.key,
            icon: op.icon,
            label: t(op.name),
            onClick: () => showOptions(op.key as 'search'),
        }),
        [showOptions, t],
    );

    useEffect(() => {
        const refreshAiEnabled = () => {
            window.api.ai
                .getSettings()
                .then((settings) => setAiEnabled(settings.enabled))
                .catch(() => setAiEnabled(false));
        };
        refreshAiEnabled();
        window.addEventListener('ai-settings-updated', refreshAiEnabled);
        return () => window.removeEventListener('ai-settings-updated', refreshAiEnabled);
    }, []);

    const menuItems: MenuProps['items'] = useMemo(
        () => [
            ...mainOptions.map(toItem),
            ...(aiEnabled
                ? [
                      {
                          key: 'ai-chat',
                          icon: <RobotOutlined />,
                          label: t('Assistant'),
                          onClick: () => showOptions('ai-chat'),
                      },
                  ]
                : []),
            { type: 'divider' as const },
            ...secondaryOptions.map(toItem),
        ],
        [aiEnabled, showOptions, t, toItem],
    );

    const bottomMenuItems: MenuProps['items'] = useMemo(
        () => bottomOptions.map((op) => toItem(op)),
        [toItem],
    );

    useEffect(() => {
        return window.api.on.switchOnOptions(() => {
            let index = cyclableOptions.findIndex((v) => optionViewRef.current === v.key);
            index = index >= 0 && cyclableOptions[index + 1] ? index + 1 : 0;
            showOptions(cyclableOptions[index].key as 'search');
        });
    }, [showOptions]);

    return (
        <Sider
            className="layout__sidebar"
            theme="light"
            collapsible
            collapsed={collapsed}
            onCollapse={onCollapse}
        >
            <div className="full-item-separated">
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <Menu mode="inline" selectedKeys={[optionView]} items={menuItems} />
                    <div style={{ flex: 1 }} />
                    <Menu mode="inline" selectedKeys={[optionView]} items={bottomMenuItems} />
                </div>
                <AudioDocumentPlayerIndicator />
            </div>
        </Sider>
    );
}
