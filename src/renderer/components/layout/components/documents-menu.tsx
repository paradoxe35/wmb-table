import React, { useState } from 'react';

type Tabs = {
    name: string;
    active: boolean;
};

const PanelGroup: React.FC<{ tabs: Tabs[]; children: (index: number) => React.ReactNode }> =
    function ({ children, tabs }) {
        const [active, setActive] = useState(tabs.findIndex((t) => t.active));
        return (
            <>
                <div className="panel__group">
                    <div className="tabs">
                        <div className="tab-squeeze">
                            <div className="tab-holder">
                                {tabs.map((tab, i) => (
                                    <div
                                        key={i}
                                        title={tab.name}
                                        onClick={() => setActive(i)}
                                        className={`tab look-and-feel ${
                                            active < 0 && i === 0
                                                ? 'active'
                                                : i === active
                                                  ? 'active'
                                                  : ''
                                        } `}
                                    >
                                        <div>
                                            <span>{tab.name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                {tabs.length > 0 && children(active)}
            </>
        );
    };

export default PanelGroup;
