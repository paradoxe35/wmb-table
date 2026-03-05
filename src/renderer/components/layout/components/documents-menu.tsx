import React, { useState } from 'react';
import { motion } from 'framer-motion';

type Tabs = {
    name: string;
    active: boolean;
};

const PanelGroup: React.FC<{ tabs: Tabs[]; children: (index: number) => React.ReactNode }> =
    function ({ children, tabs }) {
        const [active, setActive] = useState(tabs.findIndex((t) => t.active));
        const currentActive = active < 0 ? 0 : active;

        return (
            <>
                <div className="panel-tabs">
                    {tabs.map((tab, i) => {
                        const isActive = i === currentActive;
                        return (
                            <button
                                key={i}
                                title={tab.name}
                                onClick={() => setActive(i)}
                                className={`panel-tab ${isActive ? 'panel-tab--active' : ''}`}
                            >
                                {tab.name}
                                {isActive && (
                                    <motion.div
                                        className="panel-tab__indicator"
                                        layoutId="panel-tab-indicator"
                                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
                {tabs.length > 0 && children(currentActive)}
            </>
        );
    };

export default PanelGroup;
