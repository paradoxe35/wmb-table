import React, { useState } from 'react';

type Tabs = {
    name: string;
    active: boolean;
};

const PanelGroup: React.FC<{ tabs: Tabs[]; children: (index: number) => React.ReactNode }> =
    function ({ children, tabs }) {
        const [active, setActive] = useState(tabs.findIndex((t) => t.active));
        const currentActive = active < 0 ? 0 : active;

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
                                            onClick={() => setActive(i)}
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
