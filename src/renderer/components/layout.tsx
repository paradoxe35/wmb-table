import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Layout, Space, Spin, Tooltip } from 'antd';
import {
    LeftCircleOutlined,
    RightCircleOutlined,
    LoadingOutlined,
    CloudSyncOutlined,
} from '@ant-design/icons';

import ViewerMenu from './layout/viewer-menu';
import SidebarMenu from './layout/sidebar-menu';
import SidebarDocuments from './layout/sidebar-documents';
import MiniPlayerBar from './mini-player-bar';
import { AudioProvider } from './audio-context';
import { useContainerHeight } from '@renderer/hooks';
import { useAppStore } from '@renderer/stores';
import { APP_NAME } from '@renderer/utils/constants';

const { Header, Content } = Layout;

function Title() {
    const { t } = useTranslation();
    const appLoaded = useAppStore((s) => s.loaded);
    const syncing = useAppStore((s) => s.syncing);

    const showSpinner = !appLoaded || syncing;
    const hint = !appLoaded
        ? t('Chargement des données...')
        : syncing
          ? t('Synchronisation en cours...')
          : '';

    return (
        <Space orientation="horizontal">
            <span>{APP_NAME}</span>
            {showSpinner && (
                <Tooltip title={hint}>
                    {syncing && appLoaded ? (
                        <CloudSyncOutlined
                            style={{
                                fontSize: 14,
                                color: 'var(--ant-color-primary)',
                                opacity: 0.7,
                            }}
                        />
                    ) : (
                        <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                    )}
                </Tooltip>
            )}
        </Space>
    );
}

const SidebarStatusHandler = () => {
    const sidebarHidden = useAppStore((s) => s.sidebarHidden);
    const setSidebarHidden = useAppStore((s) => s.setSidebarHidden);
    const toggleSidebar = useAppStore((s) => s.toggleSidebar);

    useEffect(() => {
        window.api.app.getSidebarStatus().then((status) => {
            if (status) setSidebarHidden(status.hidden);
        });
    }, [setSidebarHidden]);

    const handleToggle = useCallback(() => {
        toggleSidebar();
        const next = useAppStore.getState().sidebarHidden;
        window.api.app.setSidebarStatus(next);
    }, [toggleSidebar]);

    useEffect(() => {
        return window.api.on.toggleSidebar(handleToggle);
    }, [handleToggle]);

    return (
        <Button type="link" onClick={handleToggle}>
            {sidebarHidden ? (
                <LeftCircleOutlined style={{ fontSize: '1.2em' }} />
            ) : (
                <RightCircleOutlined style={{ fontSize: '1.2em' }} />
            )}
        </Button>
    );
};

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const [collapsed, setCollapsed] = useState(true);

    const toggle = (collapsed?: boolean | unknown) => {
        return typeof collapsed === 'boolean' ? setCollapsed(collapsed) : setCollapsed((c) => !c);
    };

    const containerScroll = useContainerHeight<HTMLDivElement>();

    return (
        <AudioProvider>
            <Layout>
                <Header className="app-header">
                    <div className="logo" onClick={() => toggle()}>
                        <Title />
                    </div>
                    <div style={{ flexGrow: 1 }}>
                        <ViewerMenu />
                    </div>
                    <div className="logo">
                        <SidebarStatusHandler />
                    </div>
                </Header>
                <Layout style={{ overflow: 'hidden' }}>
                    <SidebarMenu onCollapse={toggle} collapsed={collapsed} />
                    <Layout>
                        <div ref={containerScroll} className="site-layout-content">
                            <Content
                                style={{
                                    padding: 24,
                                    paddingBottom: 0,
                                    flex: 1,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                {children}
                            </Content>
                        </div>
                    </Layout>
                    <SidebarDocuments />
                </Layout>
            </Layout>
            <div style={{ display: 'none' }}>
                <MiniPlayerBar />
            </div>
        </AudioProvider>
    );
};

export default AppLayout;
