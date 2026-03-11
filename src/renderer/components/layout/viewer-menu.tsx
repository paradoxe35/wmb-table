import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FundViewOutlined, ProfileOutlined } from '@ant-design/icons';
import { Menu } from 'antd';
import { useAppStore } from '@renderer/stores';
import type { ViewMenuValue } from '@shared/types';
import { ItemType, MenuItemType } from 'antd/es/menu/interface';

export default function ViewerMenu() {
    const { t } = useTranslation();
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

    const items = useMemo(() => {
        return [
            {
                key: 'options',
                title: t('Outils'),
                icon: (
                    <ProfileOutlined
                        style={{ fontSize: '20px', verticalAlign: 'middle', marginLeft: '15%' }}
                    />
                ),
                onClick: showOptions,
            },
            {
                key: 'document',
                title: t('Lecture'),
                icon: (
                    <FundViewOutlined
                        style={{ fontSize: '20px', verticalAlign: 'middle', marginLeft: '15%' }}
                    />
                ),
                onClick: showDocument,
            },
        ] satisfies ItemType<MenuItemType>[];
    }, [showOptions, showDocument, t]);

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
