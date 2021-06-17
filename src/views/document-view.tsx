import React, { useEffect, useMemo, useRef, useState } from 'react';
import DocumentTabs from '../components/document-tabs';
import { Layout } from 'antd';
import {
  currentDocumentTabs,
  documentTabs,
  documentViewQuery,
  selectedSubjectDocumentItem,
} from '../store';
import { useRecoilState, useRecoilValue } from 'recoil';
import sendIpcRequest from '../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../utils/ipc-events';
import { useContainerScrollY, useValueStateRef } from '../utils/hooks';
import { debounce } from '../utils/functions';
import { DocumentViewQuery, SubjectDocumentItem } from '../types';

import { SubjectSelectModal } from './components/subject-select-modal';
import { ModalSearchDocument } from './components/modal-search-document';

const { Content } = Layout;

function postMessage(
  iframeEl: HTMLIFrameElement,
  type: string,
  detail: any,
  path: string
) {
  window.setTimeout(() => {
    iframeEl.contentWindow?.postMessage({ type, detail }, path as string);
  }, 1000);
}

export default function DocumentView() {
  const title = useRecoilValue(currentDocumentTabs);

  const [path, setPath] = useState<string | null>(null);

  const iframeRef = useContainerScrollY<HTMLIFrameElement>([window], 40, true);

  const [tabs, setTabs] = useRecoilState(documentTabs);

  const [viewQuery, setDocumentViewQuery] = useRecoilState(documentViewQuery);

  const documentQuery = useRef<DocumentViewQuery | null>(null);

  const [subjectItemSelected, setSubjectItemSelected] = useRecoilState(
    selectedSubjectDocumentItem
  );

  const subjectItemSelectedRef = useRef<SubjectDocumentItem | null>(null);

  const titleRef = useValueStateRef(title);

  useEffect(() => {
    const closeDocumentQuery = () => {
      setDocumentViewQuery((qs) =>
        qs.filter((q) => q.documentTitle != titleRef.current)
      );
    };
    window.addEventListener('close-document-query', closeDocumentQuery);
    return () => {
      window.removeEventListener('close-document-query', closeDocumentQuery);
    };
  }, []);

  subjectItemSelectedRef.current = useMemo(() => {
    return subjectItemSelected;
  }, [subjectItemSelected]);

  documentQuery.current = useMemo(() => {
    return viewQuery.find((v) => v.documentTitle == title) || null;
  }, [title, viewQuery]);

  useEffect(() => {
    if (documentQuery.current) {
      iframeRef.current?.contentWindow?.location.reload();
    }
  }, [viewQuery]);

  useEffect(() => {
    if (subjectItemSelectedRef.current) {
      iframeRef.current?.contentWindow?.location.reload();
    }
  }, [subjectItemSelected]);

  useEffect(() => {
    if (title) {
      sendIpcRequest<string>(IPC_EVENTS.document_content_path, title).then(
        (p) => p && setPath(p)
      );
    }
  }, [title]);

  const handleSearchQuery = (
    iframeEl: HTMLIFrameElement,
    hasOwnPosition: boolean
  ) => {
    if (subjectItemSelectedRef.current) {
      postMessage(
        iframeEl,
        'subject-item',
        subjectItemSelectedRef.current,
        path as string
      );
      setSubjectItemSelected(null);
    } else if (documentQuery.current) {
      postMessage(
        iframeEl,
        'document-query',
        documentQuery.current,
        path as string
      );
    } else if (!hasOwnPosition) {
      const container = iframeEl.contentDocument?.getElementById(
        'page-container'
      )?.firstElementChild?.firstElementChild;
      container
        ?.querySelector('div')
        ?.scrollIntoView({ inline: 'center', behavior: 'smooth' });
    }
  };

  const onIframeLoad = () => {
    if (iframeRef.current) {
      const page = iframeRef.current.contentDocument?.querySelector(
        '#page-container'
      );

      const tab = tabs.find((t) => t.title === title);
      let hasOwnPosition = false;

      if ((tab?.scrollY || tab?.scrollX) && page) {
        hasOwnPosition = true;

        if (!(subjectItemSelectedRef.current || documentQuery.current)) {
          postMessage(
            iframeRef.current,
            'window-position',
            {
              top: tab.scrollY || undefined,
              left: tab.scrollX || undefined,
            },
            path as string
          );

          page.scrollTo({
            top: tab.scrollY || undefined,
            left: tab.scrollX || undefined,
            behavior: 'smooth',
          });
        }
      }

      const load = {
        count: 0,
      };

      const onScroll = (): number | void => {
        if (load.count === 0) {
          return (load.count = 1);
        }
        setTabs((ts) => {
          return ts.map((t) => {
            const nt = { ...t };
            if (nt.title === title) {
              nt.scrollY = page?.scrollTop;
              nt.scrollX = page?.scrollLeft;
            }
            return nt;
          });
        });
      };

      page?.addEventListener('scroll', debounce(onScroll, 1000));
      handleSearchQuery(iframeRef.current, hasOwnPosition);
    }
  };

  return (
    <>
      <DocumentTabs />
      <Content className="mock-browser-content">
        <iframe
          ref={iframeRef}
          hidden={!path}
          width="100%"
          onLoad={onIframeLoad}
          src={path || undefined}
          frameBorder="0"
        />
      </Content>
      <ModalSearchDocument
        iframeRef={iframeRef}
        documentQuery={documentQuery.current}
        title={title}
      />
      <SubjectSelectModal title={title} />
    </>
  );
}
