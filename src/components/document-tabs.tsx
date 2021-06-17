import React, { useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import ChromeTabs from '../plugins/chrome-tabs/chrome-tabs';
import { currentDocumentTabs, documentTabs } from '../store';
import { DocumentTab } from '../types';
import { FileFilled } from '@ant-design/icons';
import sendIpcRequest from '../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../utils/ipc-events';

function Tab({ tab }: { tab: DocumentTab }) {
  const tabRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (tabRef.current && tab.active) {
      tabRef.current.setAttribute('active', `${tab.active}`);
    }
  }, []);
  return (
    //@ts-ignore
    <div className="chrome-tab" title={tab.title} ref={tabRef}>
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

const useDocumentTabs = () => {
  const tabRef = useRef<HTMLDivElement | null>(null);

  const currentTitle = useRecoilValue(currentDocumentTabs);

  const [tabs, setTabs] = useRecoilState(documentTabs);

  const [key, setKey] = useState(0);

  const reloadRef = useRef<boolean>(true);
  const tabsRef = useRef<DocumentTab[]>(tabs);

  const prevTabsRef = useRef<DocumentTab[]>([]);

  useEffect(() => {
    if (!tabs.length && currentTitle) {
      sendIpcRequest<DocumentTab[] | null>(IPC_EVENTS.document_tabs).then(
        (docs) => {
          if (!docs || (docs && !docs.length)) {
            setTabs([{ title: currentTitle, active: true, scrollY: 0 }]);
          } else {
            setTabs(docs);
          }
        }
      );
    }
  }, [currentTitle]);

  useEffect(() => {
    tabs.length && sendIpcRequest(IPC_EVENTS.document_tabs, tabs);
  }, [tabs]);

  useEffect(() => {
    const preveTab = prevTabsRef.current;
    const active = prevTabsRef.current.find((d) => d.active);
    if (
      preveTab.length === tabs.length &&
      preveTab.every((v) => tabs.map((t) => t.title).includes(v.title)) &&
      active &&
      tabs.some((t) => t.title === active.title && t.active === active.active)
    ) {
      return;
    }
    if (reloadRef.current) {
      tabsRef.current = tabs;
      setKey((c) => c + 1);
    } else {
      reloadRef.current = true;
    }
    prevTabsRef.current = tabs;
  }, [tabs]);

  return {
    tabRef,
    key,
    setKey,
    setTabs,
    tabs: tabsRef.current,
    reloadRef,
  };
};

export default function DocumentTabs() {
  const { tabRef, setTabs, tabs, key, reloadRef } = useDocumentTabs();

  useEffect(() => {
    if (tabRef.current) {
      const chromeTabs = new ChromeTabs();
      chromeTabs.init(tabRef.current);

      tabRef.current.addEventListener(
        'tabReorder',
        (event: CustomEventInit) => {
          if (!event.detail) return;
          const arr = Array.from(
            tabRef.current?.querySelectorAll('.chrome-tab') || []
          )
            .map((el) => tabs.find((t) => t.title === el.getAttribute('title')))
            .filter(Boolean) as DocumentTab[];

          reloadRef.current = false;
          setTabs(arr);
        }
      );
      tabRef.current.addEventListener(
        'activeTabChange',
        (event: CustomEventInit) => {
          const { tabEl } = event.detail as { tabEl: HTMLDivElement };
          setTabs((ts) =>
            ts.map((t) => {
              const nt = { ...t };
              if (nt.title === tabEl.getAttribute('title')) {
                nt.active = true;
              } else {
                nt.active = false;
              }
              return nt;
            })
          );
        }
      );
      tabRef.current.addEventListener('tabRemove', (event: CustomEventInit) => {
        const { tabEl } = event.detail as { tabEl: HTMLDivElement };
        setTabs((ts) =>
          ts.filter((t) => t.title != tabEl.getAttribute('title'))
        );
      });
    }
  }, [key]);

  return <Tabs key={key} tabs={tabs} ref={tabRef} />;
}
