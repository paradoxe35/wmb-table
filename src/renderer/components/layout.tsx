import React, { useCallback, useEffect, useState } from 'react';
import { Button, Layout, Space, Spin } from 'antd';
import { LeftCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';

import ViewerMenu from './layout/viewer-menu';
import SidebarMenu from './layout/sidebar-menu';
import SidebarDocuments from './layout/sidebar-documents';
import { useContainerHeight } from '@renderer/hooks';
import { useAppStore } from '@renderer/stores';
import { APP_NAME } from '@renderer/utils/constants';

const { Header, Content } = Layout;

function Title() {
    const appLoaded = useAppStore((s) => s.loaded);
    return (
        <Space direction="horizontal">
            <span>{APP_NAME}</span>
            {!appLoaded && <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />}
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
            <motion.div
                animate={{ rotate: sidebarHidden ? 0 : 180 }}
                transition={{ duration: 0.25 }}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                <LeftCircleOutlined style={{ fontSize: '1.2em' }} />
            </motion.div>
        </Button>
    );
};

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const [collapsed, setCollapsed] = useState(true);

    const toggle = (collapsed?: boolean | unknown) =>
        typeof collapsed === 'boolean' ? setCollapsed(collapsed) : setCollapsed((c) => !c);

    const containerScroll = useContainerHeight<HTMLDivElement>();

    return (
        <Layout>
            <Header className="app-header">
                <div className="logo" onClick={() => toggle()}>
                    <Title />
                </div>
                <div className="header-center">
                    <ViewerMenu />
                </div>
                <div className="logo">
                    <SidebarStatusHandler />
                </div>
            </Header>
            <Layout>
                <SidebarMenu onCollapse={toggle} collapsed={collapsed} />
                <Layout>
                    <div ref={containerScroll} className="site-layout-content">
                        <Content className="main-content">{children}</Content>
                    </div>
                </Layout>
                <SidebarDocuments />
            </Layout>
        </Layout>
    );
};

export default AppLayout;
