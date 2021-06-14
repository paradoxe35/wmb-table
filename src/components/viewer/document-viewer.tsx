import React from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { appViewState, documentTabs, MAIN_VIEWS } from '../../store';

const DocumentViewer: React.FC<{
  name: string;
  id: string;
  onItemClick?: Function;
}> = ({ children, name, onItemClick }) => {
  const [tabs, setTabs] = useRecoilState(documentTabs);
  const setDocumentViewer = useSetRecoilState(appViewState);

  const onClick = () => {
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
  return <span onClick={onClick}>{children}</span>;
};

export default DocumentViewer;
