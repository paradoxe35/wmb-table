import { useMemo, useState } from 'react';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { BibleIcons } from '@renderer/components/icons';
import LoadByVisibility from '@renderer/components/load-by-visibility';
import { BibleVersionSelector } from './bible/bible-version-selector';
import { BibleContent } from './bible/bible-content';
import { SearchContent } from './bible/bible-search';
import { getBiblePageHelp } from './components/option-help-content';
import OptionPageLayout from './components/option-page-layout';
export { BibleContent };

export default function Bible() {
    const { t } = useTranslation();
    const [menu, setMenu] = useState<string>('bible');

    const menuItems: MenuProps['items'] = useMemo(
        () => [
            { key: 'bible', label: t('Bible'), icon: <BibleIcons /> },
            { key: 'search', label: t('Recherche'), icon: <SearchOutlined /> },
        ],
        [t],
    );

    return (
        <LoadByVisibility>
            <OptionPageLayout title={t('Bible')} help={getBiblePageHelp(t)}>
                <div className="bible-option-page">
                    <div className="bible-option-page__sticky-header">
                        <Menu
                            className="bible-option-page__menu"
                            mode="horizontal"
                            selectedKeys={[menu]}
                            onClick={(e) => setMenu(e.key)}
                            items={menuItems}
                        />
                        <BibleVersionSelector />
                    </div>
                    {menu === 'bible' && <BibleContent verseMetaContent={true} />}
                    {menu === 'search' && (
                        <div className="bible-search-content">
                            <SearchContent />
                        </div>
                    )}
                </div>
            </OptionPageLayout>
        </LoadByVisibility>
    );
}
