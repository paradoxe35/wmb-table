import React from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { appViewState, documentTabs, MAIN_VIEWS } from '../../store';

const DocumentViewer: React.FC<{ name: string; id: string }> = ({
  children,
  name,
}) => {
  const [tabs, setTabs] = useRecoilState(documentTabs);
  const setDocumentViewer = useSetRecoilState(appViewState);

  const onClick = () => {
    const existTab = tabs.some((t) => t.title === name);

    const activated = tabs.some((t) => t.title === name && t.active);
    setDocumentViewer(MAIN_VIEWS.document);

    if (activated) return;

    if (existTab) {
      setTabs((ts) =>
        ts.map((t) => {
          const nt = { ...t };
          if (nt.title === name) {
            nt.active = true;
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
        return [...nts, { title: name, active: true }];
      });
    }
  };
  return <span onClick={onClick}>{children}</span>;
};

export default DocumentViewer;
