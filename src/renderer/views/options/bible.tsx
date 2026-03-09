import { useMemo, useState } from 'react';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { BibleIcons } from '@renderer/components/icons';
import LoadByVisibility from '@renderer/components/load-by-visibility';
import { BibleVersionSelector } from './bible/bible-version-selector';
import { BibleContent } from './bible/bible-content';
import { SearchContent } from './bible/bible-search';
export { BibleContent };

export default function Bible() {
    const [menu, setMenu] = useState<string>('bible');

    const menuItems: MenuProps['items'] = useMemo(
        () => [
            { key: 'bible', label: 'Bible', icon: <BibleIcons /> },
            { key: 'search', label: 'Recherche', icon: <SearchOutlined /> },
        ],
        [],
    );

    return (
        <LoadByVisibility>
            <Menu
                mode="horizontal"
                selectedKeys={[menu]}
                onClick={(e) => setMenu(e.key)}
                items={menuItems}
                style={{ marginBottom: 12 }}
            />
            <BibleVersionSelector />
            {menu === 'bible' && <BibleContent verseMetaContent={true} />}
            {menu === 'search' && (
                <div className="bible-search-content">
                    <SearchContent />
                </div>
            )}
        </LoadByVisibility>
    );
}
