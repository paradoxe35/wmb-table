import React, { useEffect, useMemo, useRef, useState } from 'react';
import DocumentTabs from '../components/document-tabs';
import { Layout } from 'antd';
import {
  currentDocumentTabsSelector,
  documentTabsStore,
  documentViewQueryStore,
  selectedSubjectDocumentItemStore,
} from '../store';
import { useRecoilState, useRecoilValue } from 'recoil';
import sendIpcRequest from '../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../utils/ipc-events';
import { useContainerScrollY, useValueStateRef } from '../utils/hooks';
import { debounce } from '../utils/functions';
import { DocumentViewQuery } from '../types';

import { SubjectSelectModal } from './components/subject-select-modal';
import { ModalSearchDocument } from './components/modal-search-document';
import { NoteReferencesModal } from './components/note-references-modal';
import { shell } from 'electron';

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
  const title = useRecoilValue(currentDocumentTabsSelector);

  const [path, setPath] = useState<string | null>(null);

  const iframeRef = useContainerScrollY<HTMLIFrameElement>([window], 40, true);

  const [tabs, setTabs] = useRecoilState(documentTabsStore);

  const [viewQuery, setDocumentViewQuery] = useRecoilState(
    documentViewQueryStore
  );

  const documentQuery = useRef<DocumentViewQuery | null>(null);

  const [subjectItemSelected, setSubjectItemSelected] = useRecoilState(
    selectedSubjectDocumentItemStore
  );

  const subjectItemSelectedRef = useValueStateRef(subjectItemSelected);

  const titleRef = useValueStateRef(title);

  const pageRef = useRef<HTMLElement | null>(null);

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

  documentQuery.current = useMemo(() => {
    return viewQuery.find((v) => v.documentTitle == title) || null;
  }, [title, viewQuery]);

  useEffect(() => {
    if (documentQuery.current) {
      window.dispatchEvent(new Event('frame-document-search-start'));
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
      ) as HTMLElement | null | undefined;

      const tab = tabs.find((t) => t.title === title);
      let hasOwnPosition = false;

      pageRef.current = page as HTMLElement;

      // handle zoom
      page && (page.style.zoom = (tab?.zoom || 100) + '%');

      if (tab?.zoom) {
        postMessage(
          iframeRef.current,
          'document-zoom',
          tab?.zoom,
          path as string
        );
      }

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

      page?.addEventListener('click', (event: MouseEvent) => {
        let target = event.target as HTMLElement;
        const hasLink = [
          target,
          target.parentElement,
          target.parentElement?.parentElement,
        ].find((el) => el && el.tagName === 'A');
        if (hasLink) {
          event.preventDefault();
          const href = hasLink.getAttribute('href');
          href && shell.openExternal(href);
        }
      });

      page?.addEventListener('scroll', debounce(onScroll, 300));
      handleSearchQuery(iframeRef.current, hasOwnPosition);
    }
  };

  useEffect(() => {
    const documentZoom = (e: Event) => {
      setTabs((ts) => {
        return ts.map((t) => {
          const nt = { ...t };
          if (nt.title === titleRef.current) {
            // @ts-ignore
            nt.zoom = e.detail.zoom;
          }
          return nt;
        });
      });

      if (pageRef.current) {
        pageRef.current.dispatchEvent(new Event('scroll'));
      }
    };

    window.addEventListener('document-current-zoom', documentZoom);
    return () => {
      window.addEventListener('document-current-zoom', documentZoom);
    };
  }, []);

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
      <NoteReferencesModal title={title} />
    </>
  );
}
