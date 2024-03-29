import React from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { appViewStore, documentTabsStore, MAIN_VIEWS } from '@renderer/store';
import { useValueStateRef } from '@renderer/hooks';

export const useDocumentViewOpen = () => {
  const [tabs, setTabs] = useRecoilState(documentTabsStore);
  const setDocumentViewer = useSetRecoilState(appViewStore);

  const tabsRef = useValueStateRef(tabs);

  const onClick = (name: string, onItemClick?: Function) => {
    const tabs = tabsRef.current;

    const existTab = tabs.some((t) => t.title === name);

    const activated = tabs.some((t) => t.title === name && t.active);
    setDocumentViewer(MAIN_VIEWS.document);

    onItemClick && onItemClick();

    if (activated) return;

    if (existTab) {
      setTabs((ts) =>
        ts.map((t) => {
          const nt = { ...t };
          if (nt.title === name) {
            nt.active = true;
          } else {
            nt.active = false;
          }
          return nt;
        })
      );
    } else {
      setTabs((ts) => {
        const nts = ts.map((t) => {
          const nt = { ...t };
          nt.active = false;
          return nt;
        });
        const narr = [...nts, { title: name, active: true }];
        narr.length >= 6 && narr.shift();

        return narr;
      });
    }
  };

  return onClick;
};

const DocumentViewer: React.FC<{
  name: string;
  id?: string;
  onItemClick?: Function;
}> = ({ children, name, onItemClick }) => {
  const viewDocument = useDocumentViewOpen();

  return (
    <span onClick={() => viewDocument(name, onItemClick)}>{children}</span>
  );
};

export default DocumentViewer;
