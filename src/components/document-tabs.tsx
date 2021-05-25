import React, { useEffect, useRef } from 'react';
import ChromeTabs from '../modules/chrome-tabs';

export default function DocumentTabs() {
  const tabRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (tabRef.current) {
      const chromeTabs = new ChromeTabs();

      chromeTabs.init(tabRef.current);
    }
  }, []);

  return (
    <>
      <div className="chrome-tabs" ref={tabRef}>
        <div className="chrome-tabs-content"></div>
        <div className="chrome-tabs-bottom-bar"></div>
      </div>
      <div className="chrome-tabs-optional-shadow-below-bottom-bar"></div>
    </>
  );
}
