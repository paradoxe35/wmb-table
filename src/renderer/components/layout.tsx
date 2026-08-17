import React, { useCallback, useEffect, useState } from 'react';
import { Button, Layout } from 'antd';
import { LeftCircleOutlined, RightCircleOutlined } from '@ant-design/icons';

import ViewerMenu from './layout/viewer-menu';
import AppStatusIndicator from './layout/app-status-indicator';
import SidebarMenu from './layout/sidebar-menu';
import SidebarDocuments from './layout/sidebar-documents';
import MiniPlayerBar from './mini-player-bar';
import FeatureReminderBanner from './feature-reminder-banner';
import { AudioProvider } from './audio-context';
import { useContainerHeight } from '@renderer/hooks';
import { useAppStore } from '@renderer/stores';
import { APP_NAME } from '@renderer/utils/constants';

const { Header, Content } = Layout;

function Title() {
    return (
        <span className="app-title">
            {APP_NAME}
            <AppStatusIndicator />
        </span>
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
        window.api.app.setSidebarStatus(!sidebarHidden);
    }, [sidebarHidden, toggleSidebar]);

    useEffect(() => {
        return window.api.on.toggleSidebar(handleToggle);
    }, [handleToggle]);

    return (
        <Button type="link" onClick={handleToggle}>
            {sidebarHidden ? (
                <LeftCircleOutlined style={{ fontSize: 'var(--fs-rel-6xl)' }} />
            ) : (
                <RightCircleOutlined style={{ fontSize: 'var(--fs-rel-6xl)' }} />
            )}
        </Button>
    );
};

const ReadingModeHandler = () => {
    const toggleReadingMode = useAppStore((s) => s.toggleReadingMode);

    useEffect(() => {
        return window.api.on.toggleReadingMode(toggleReadingMode);
    }, [toggleReadingMode]);

    return null;
};

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const [collapsed, setCollapsed] = useState(true);
    const readingMode = useAppStore((s) => s.readingMode);
    const containerScroll = useContainerHeight<HTMLDivElement>();

    const toggle = (collapsed?: boolean | unknown) => {
        return typeof collapsed === 'boolean' ? setCollapsed(collapsed) : setCollapsed((c) => !c);
    };

    return (
        <AudioProvider>
            <Layout className={readingMode ? 'reading-mode' : ''}>
                {!readingMode && (
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
                )}
                <Layout style={{ overflow: 'hidden' }}>
                    {!readingMode && <SidebarMenu onCollapse={toggle} collapsed={collapsed} />}

                    <Layout>
                        <div ref={containerScroll} className="site-layout-content">
                            <Content
                                style={{
                                    padding: readingMode ? 0 : '24px 24px 0px',
                                    paddingBottom: 0,
                                    flex: 1,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                {!readingMode && <FeatureReminderBanner />}
                                {children}
                            </Content>
                        </div>
                    </Layout>

                    {!readingMode && <SidebarDocuments />}
                </Layout>
            </Layout>
            <div style={{ display: 'none' }}>
                <MiniPlayerBar />
            </div>
            <ReadingModeHandler />
        </AudioProvider>
    );
};

export default AppLayout;
