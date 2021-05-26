import React, { useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import ChromeTabs from '../modules/chrome-tabs';
import { currentDocumentTabs, documentTabs } from '../store';
import { DocumentTab } from '../types';
import { FileFilled } from '@ant-design/icons';
import { strNormalize } from '../utils/functions';

function Tab({ tab }: { tab: DocumentTab }) {
  const tabRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (tabRef.current && tab.active) {
      tabRef.current.setAttribute('active', `${tab.active}`);
    }
  }, []);
  return (
    //@ts-ignore
    <div
      className="chrome-tab"
      data-ref={strNormalize(tab.title).split(' ').join('-')}
      title={tab.title}
      ref={tabRef}
    >
      <div className="chrome-tab-dividers"></div>
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
          <FileFilled />
        </div>
        <div className="chrome-tab-title">{tab.title}</div>
        <div className="chrome-tab-drag-handle"></div>
        <div className="chrome-tab-close"></div>
      </div>
    </div>
  );
}

const Tabs = React.forwardRef<HTMLDivElement, { tabs: DocumentTab[] }>(
  (props, ref: React.LegacyRef<HTMLDivElement>) => {
    return (
      <>
        <div className="chrome-tabs" ref={ref}>
          <div className="chrome-tabs-content">
            {props.tabs.map((tab) => (
              <Tab key={tab.title} tab={tab} />
            ))}
          </div>
          <div className="chrome-tabs-bottom-bar"></div>
        </div>
        <div className="chrome-tabs-optional-shadow-below-bottom-bar"></div>
      </>
    );
  }
);

export default function DocumentTabs() {
  const tabRef = useRef<HTMLDivElement | null>(null);

  const currentTitle = useRecoilValue(currentDocumentTabs);

  const [tabs, setTabs] = useRecoilState(documentTabs);

  const [key, setKey] = useState(0);

  useEffect(() => {
    if (tabRef.current) {
      const chromeTabs = new ChromeTabs();
      chromeTabs.init(tabRef.current);
    }
  }, [key]);

  useEffect(() => {
    if (!tabs.length && currentTitle) {
      setTabs([{ title: currentTitle, active: true, scrollY: 0 }]);
    }
  }, [currentTitle]);

  useEffect(() => setKey((c) => c + 1), [tabs]);

  return <Tabs key={key} tabs={tabs} ref={tabRef} />;
}
