import React, { useEffect, useMemo, useRef } from 'react';
import { HistoryOutlined, GroupOutlined, SearchOutlined, EditOutlined } from '@ant-design/icons';
import { Menu, Layout } from 'antd';
import { useAppStore } from '@renderer/stores';
import { BibleIcons } from '../icons';
import AudioDocumentPlayerIndicator from '../audio-document-player-indicator';

const { Sider } = Layout;

type OptionItem = { key: string; name: string; icon: React.ReactNode } | null;

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

    const options: OptionItem[] = useMemo(
        () => [
            { key: 'history', name: 'Historique', icon: <HistoryOutlined /> },
            { key: 'search', name: 'Recherche', icon: <SearchOutlined /> },
            { key: 'subject', name: 'Sujets', icon: <GroupOutlined /> },
            { key: 'editor', name: 'Notes', icon: <EditOutlined /> },
            null,
            { key: 'bible', name: 'Bible', icon: <BibleIcons /> },
        ],
        [],
    );

    useEffect(() => {
        const nonNull = options.filter((r): r is NonNullable<OptionItem> => r != null);
        return window.api.on.switchOnOptions(() => {
            let index = nonNull.findIndex((v) => optionViewRef.current === v.key);
            index = index >= 0 && nonNull[index + 1] ? index + 1 : 0;
            showOptions(nonNull[index].key as 'search');
        });
    }, [options, showOptions]);

    return (
        <Sider
            className="layout__sidebar"
            theme="light"
            collapsible
            collapsed={collapsed}
            onCollapse={onCollapse}
        >
            <div className="full-item-separated">
                <Menu mode="inline" selectedKeys={[optionView]}>
                    {options.map((op, i) =>
                        op === null ? (
                            <Menu.Divider key={i} />
                        ) : (
                            <Menu.Item
                                key={op.key}
                                icon={op.icon}
                                onClick={() => showOptions(op.key as 'search')}
                            >
                                {op.name}
                            </Menu.Item>
                        ),
                    )}
                </Menu>
                <AudioDocumentPlayerIndicator />
            </div>
        </Sider>
    );
}
