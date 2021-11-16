import React, { useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import ChromeTabs from '@renderer/plugins/chrome-tabs/chrome-tabs';
import {
  currentDocumentTabsSelector,
  documentTabsStore,
  titlesDocumentSelector,
} from '@renderer/store';
import { CustomDocument, DocumentTab } from '@localtypes/index';
import { FileFilled, LoadingOutlined } from '@ant-design/icons';
import sendIpcRequest from '@root/ipc/ipc-renderer';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import { Spin } from 'antd';

function Tab({ tab, title }: { tab: DocumentTab; title: string }) {
  const tabRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tabRef.current && tab.active) {
      tabRef.current.setAttribute('active', `${tab.active}`);
    }
  }, []);

  useEffect(() => {
    const startLoading = () => tab && tab.active && setLoading(true);
    const endLoading = () => setLoading(false);

    if (tab && tab.active) {
      window.addEventListener('frame-document-search-start', startLoading);
      window.addEventListener('frame-document-search-end', endLoading);

      return () => {
        window.removeEventListener('frame-document-search-start', startLoading);
        window.removeEventListener('frame-document-search-end', endLoading);
      };
    }
    return;
  }, []);

  return (
    //@ts-ignore
    <div
      className="chrome-tab"
      title={title}
      data-title={tab.title}
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
          {loading ? (
            <Spin indicator={<LoadingOutlined spin />} />
          ) : (
            <FileFilled />
          )}
        </div>
        <div className="chrome-tab-title">{title}</div>
        <div className="chrome-tab-drag-handle"></div>
        <div className="chrome-tab-close"></div>
      </div>
    </div>
  );
}

const Tabs = React.forwardRef<HTMLDivElement, { tabs: DocumentTab[] }>(
  (props, ref: React.LegacyRef<HTMLDivElement>) => {
    const $titles = useRecoilValue(titlesDocumentSelector);

    return (
      <>
        <div className="chrome-tabs" ref={ref}>
          <div className="chrome-tabs-content">
            {props.tabs.map((tab) => (
              <Tab
                key={tab.title}
                tab={tab}
                title={$titles[tab.title]?.getTitle()}
              />
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

  const currentTitle = useRecoilValue(currentDocumentTabsSelector);

  const [tabs, setTabs] = useRecoilState(documentTabsStore);
  const prevTabsRef = useRef<DocumentTab[]>(tabs);

  const [key, setKey] = useState(0);

  const reloadRef = useRef<boolean>(true);
  const tabsRef = useRef<DocumentTab[]>(tabs);

  useEffect(() => {
    (async () => {
      if (tabs !== prevTabsRef.current) {
        await sendIpcRequest(IPC_EVENTS.document_tabs, tabs);
      }
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
    })();
  }, [tabs, currentTitle]);

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
            .map((el) =>
              tabs.find((t) => t.title === el.getAttribute('data-title'))
            )
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
              if (nt.title === tabEl.getAttribute('data-title')) {
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
          ts.filter((t) => t.title != tabEl.getAttribute('data-title'))
        );
      });
    }
  }, [key]);

  useEffect(() => {
    const removeFromCustomDocument = (e: CustomEventInit<CustomDocument>) => {
      if (e.detail) {
        setTabs((ts) => {
          const nts = ts.find((t) => t.title == e.detail?.title)
            ? ts.filter((t) => t.title != e.detail?.title)
            : ts;

          const hasActive = nts.find((t) => t.active);

          return hasActive
            ? nts
            : nts.map((t, i) => {
                const nt = { ...t };
                nt.active = i == 0;
                return nt;
              });
        });
      }
    };

    window.addEventListener(
      'custom-document-removed',
      removeFromCustomDocument
    );
    return () => {
      window.removeEventListener(
        'custom-document-removed',
        removeFromCustomDocument
      );
    };
  }, []);

  return <Tabs key={key} tabs={tabs} ref={tabRef} />;
}
