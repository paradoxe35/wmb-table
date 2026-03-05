import { useCallback, useEffect, useMemo } from 'react';
import { FundViewOutlined, ProfileOutlined } from '@ant-design/icons';
import { Menu } from 'antd';
import { useAppStore } from '@renderer/stores';
import type { ViewMenuValue } from '@shared/types';

export default function ViewerMenu() {
    const mainView = useAppStore((s) => s.mainView);
    const setMainView = useAppStore((s) => s.setMainView);

    const showOptions = useCallback(() => setMainView('options'), [setMainView]);
    const showDocument = useCallback(() => setMainView('document'), [setMainView]);

    useEffect(() => {
        return window.api.on.switchOnMenu(() => {
            const current = useAppStore.getState().mainView;
            setMainView(current === 'options' ? 'document' : 'options');
        });
    }, [setMainView]);

    useEffect(() => {
        return window.api.on.changeMenuViewer((value: string) => {
            setMainView(value as ViewMenuValue);
        });
    }, [setMainView]);

    const items = useMemo(
        () => [
            {
                key: 'options',
                icon: <ProfileOutlined style={{ fontSize: '20px' }} />,
                label: '',
                onClick: showOptions,
            },
            {
                key: 'document',
                icon: <FundViewOutlined style={{ fontSize: '20px' }} />,
                label: '',
                onClick: showDocument,
            },
        ],
        [showOptions, showDocument],
    );

    return (
        <Menu
            theme="dark"
            mode="horizontal"
            className="row__center"
            selectedKeys={[mainView]}
            items={items}
        />
    );
}
