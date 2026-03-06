import React, { useEffect, useMemo, useRef } from 'react';
import { HistoryOutlined, GroupOutlined, SearchOutlined, EditOutlined } from '@ant-design/icons';
import { Menu, Layout } from 'antd';
import type { MenuProps } from 'antd';
import { useAppStore } from '@renderer/stores';
import { BibleIcons } from '../icons';
import AudioDocumentPlayerIndicator from '../audio-document-player-indicator';

const { Sider } = Layout;

type OptionDef = { key: string; name: string; icon: React.ReactNode };

export default function SidebarMenu({
    collapsed,
    onCollapse,
}: {
    collapsed: boolean;
    onCollapse?: (collapsed: boolean) => void;
}) {
    const optionView = useAppStore((s) => s.optionView);
    const showOptions = useAppStore((s) => s.showOptions);
    const optionViewRef = useRef(optionView);
    optionViewRef.current = optionView;

    const optionDefs: OptionDef[] = useMemo(
        () => [
            { key: 'history', name: 'Historique', icon: <HistoryOutlined /> },
            { key: 'search', name: 'Recherche', icon: <SearchOutlined /> },
            { key: 'subject', name: 'Sujets', icon: <GroupOutlined /> },
            { key: 'editor', name: 'Notes', icon: <EditOutlined /> },
            { key: 'bible', name: 'Bible', icon: <BibleIcons /> },
        ],
        [],
    );

    const menuItems: MenuProps['items'] = useMemo(
        () => [
            ...optionDefs.slice(0, 4).map((op) => ({
                key: op.key,
                icon: op.icon,
                label: op.name,
                onClick: () => showOptions(op.key as 'search'),
            })),
            { type: 'divider' as const },
            ...optionDefs.slice(4).map((op) => ({
                key: op.key,
                icon: op.icon,
                label: op.name,
                onClick: () => showOptions(op.key as 'search'),
            })),
        ],
        [optionDefs, showOptions],
    );

    useEffect(() => {
        return window.api.on.switchOnOptions(() => {
            let index = optionDefs.findIndex((v) => optionViewRef.current === v.key);
            index = index >= 0 && optionDefs[index + 1] ? index + 1 : 0;
            showOptions(optionDefs[index].key as 'search');
        });
    }, [optionDefs, showOptions]);

    return (
        <Sider
            className="layout__sidebar"
            theme="light"
            collapsible
            collapsed={collapsed}
            onCollapse={onCollapse}
        >
            <div className="full-item-separated">
                <Menu mode="inline" selectedKeys={[optionView]} items={menuItems} />
                <AudioDocumentPlayerIndicator />
            </div>
        </Sider>
    );
}
