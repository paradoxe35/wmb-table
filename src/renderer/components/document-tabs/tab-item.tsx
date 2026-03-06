import { Reorder } from 'framer-motion';
import { FileFilled } from '@ant-design/icons';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import type { DocumentTab } from '@shared/types';

export default function TabItem({
    tab,
    isActive,
    onActivate,
    onRemove,
    contextMenuItems,
}: {
    tab: DocumentTab;
    isActive: boolean;
    onActivate: () => void;
    onRemove: () => void;
    contextMenuItems: MenuProps['items'];
}) {
    return (
        <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
            <Reorder.Item
                value={tab}
                as="div"
                className="chrome-tab"
                data-active={isActive}
                onClick={onActivate}
                onMouseDown={(e) => {
                    if (e.button === 1) {
                        e.preventDefault();
                        onRemove();
                    }
                }}
            >
                <div className="chrome-tab-dividers" />
                <div className="chrome-tab-background">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <symbol id="chrome-tab-geometry-left" viewBox="0 0 214 36">
                                <path d="M17 0h197v36H0v-2c4.5 0 9-3.5 9-8V8c0-4.5 3.5-8 8-8z" />
                            </symbol>
                            <symbol id="chrome-tab-geometry-right" viewBox="0 0 214 36">
                                <use xlinkHref="#chrome-tab-geometry-left" />
                            </symbol>
                            <clipPath id="crop">
                                <rect className="mask" width="100%" height="100%" x="0" />
                            </clipPath>
                        </defs>
                        <svg width="52%" height="100%">
                            <use
                                xlinkHref="#chrome-tab-geometry-left"
                                width="214"
                                height="36"
                                className="chrome-tab-geometry"
                            />
                        </svg>
                        <g transform="scale(-1, 1)">
                            <svg width="52%" height="100%" x="-100%" y="0">
                                <use
                                    xlinkHref="#chrome-tab-geometry-right"
                                    width="214"
                                    height="36"
                                    className="chrome-tab-geometry"
                                />
                            </svg>
                        </g>
                    </svg>
                </div>
                <div className="chrome-tab-content">
                    <div className="chrome-tab-favicon">
                        <FileFilled style={{ fontSize: 12 }} />
                    </div>
                    <div className="chrome-tab-title" title={tab.title}>
                        {tab.title}
                    </div>
                    <div className="chrome-tab-drag-handle" />
                    <div
                        className="chrome-tab-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                    />
                </div>
            </Reorder.Item>
        </Dropdown>
    );
}
