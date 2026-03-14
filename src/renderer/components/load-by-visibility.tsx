import React, { useEffect, useRef, useState } from 'react';
import { respondToVisibility } from '@renderer/utils/functions';

const LoadByVisibility: React.FC<{ children?: React.ReactNode }> = function ({ children }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [load, setLoaded] = useState(false);

    useEffect(() => {
        let hasWidth = 0;
        const rebuildEl = () => {
            if (containerRef.current) {
                const { width } = containerRef.current.getBoundingClientRect();
                if (hasWidth === width) return;
                hasWidth = width;
                setLoaded(true);
            }
        };

        window.addEventListener('load', rebuildEl);

        let unobserve: (() => void) | null = null;
        if (hasWidth === 0 && containerRef.current) {
            unobserve = respondToVisibility(containerRef.current, (isVisible) => {
                if (hasWidth === 0 && isVisible) rebuildEl();
            });
        }

        return () => {
            window.removeEventListener('load', rebuildEl);
            unobserve?.();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
            {load ? children : null}
        </div>
    );
};
export default LoadByVisibility;
