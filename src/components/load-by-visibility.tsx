import React, { useEffect, useRef, useState } from 'react';
import { respondToVisibility } from '../utils/functions';

const LoadByVisibility: React.FC = function ({ children }) {
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

    let unobserve: { (): any; (): void } | null = null;
    if (hasWidth === 0) {
      unobserve = respondToVisibility(
        (containerRef.current as unknown) as Element,
        (isVisible) => {
          if (hasWidth === 0 && isVisible) rebuildEl();
        }
      );
    }

    return () => {
      window.removeEventListener('load', rebuildEl);
      unobserve && unobserve();
    };
  }, []);

  return <div ref={containerRef}>{load ? children : []}</div>;
};
export default LoadByVisibility;
