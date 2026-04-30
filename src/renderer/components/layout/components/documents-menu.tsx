import React from 'react';

type Tabs = {
    name: string;
};

const PanelGroup: React.FC<{
    tabs: Tabs[];
    activeIndex: number;
    onChange: (index: number) => void;
    children: (index: number) => React.ReactNode;
}> = function ({ children, tabs, activeIndex, onChange }) {
    const currentActive = activeIndex < 0 ? 0 : activeIndex;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div className="panel__group">
                <div className="tabs">
                    <div className="tab-squeeze">
                        <div className="tab-holder">
                            {tabs.map((tab, i) => {
                                return (
                                    <div
                                        key={i}
                                        title={tab.name}
                                        onClick={() => onChange(i)}
                                        className={`tab ${i === currentActive ? 'active' : ''}`}
                                    >
                                        <div>
                                            <span>{tab.name}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            <div
                style={{
                    flex: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {tabs.length > 0 && children(currentActive)}
            </div>
        </div>
    );
};

export default PanelGroup;
