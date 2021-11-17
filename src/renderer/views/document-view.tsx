import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import DocumentTabs from '../components/document-tabs';
import { Layout } from 'antd';
import {
  currentDocumentTabsSelector,
  documentTabsStore,
  documentViewQueryStore,
  selectedSubjectDocumentItemStore,
  titlesDocumentSelector,
} from '@renderer/store';
import { SetterOrUpdater, useRecoilState, useRecoilValue } from 'recoil';
import sendIpcRequest from '@root/ipc/ipc-renderer';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import { useContainerScrollY, useValueStateRef } from '@renderer/hooks';
import { debounce } from '@root/utils/functions';
import { DocumentViewQuery, SubjectDocumentItem } from '@localtypes/index';

import { SubjectSelectModal } from './components/subject-select-modal';
import { ModalSearchDocument } from './components/modal-search-document';
import { NoteReferencesModal } from './components/note-references-modal';
import { shell } from 'electron';
import {
  CHILD_PARENT_WINDOW_EVENT,
  DOCUMENT_CONTAINER_ID,
  PARENT_WINDOW_EVENT,
  POST_MESSAGE_EVENT,
} from '@modules/shared/shared';

const { Content } = Layout;

const usePostMessage = () => {
  // handle post message request to child only when child content has been fully loaded
  const waitForDocumentViewStarted = useCallback(() => {
    return new Promise<any>((resolve) => {
      window.addEventListener(
        CHILD_PARENT_WINDOW_EVENT.documentViewLoaded,
        resolve,
        {
          once: true,
        }
      );
    });
  }, []);

  const postMessage = useCallback(
    async (
      iframeEl: HTMLIFrameElement,
      type: string,
      detail: any,
      path: string
    ) => {
      await waitForDocumentViewStarted();
      iframeEl.contentWindow?.postMessage({ type, detail }, path as string);
    },
    []
  );
  // end of post message handler

  return postMessage;
};

const useDocumentQuery = (
  titleRef: React.MutableRefObject<string>,
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>
) => {
  const [viewQuery, setDocumentViewQuery] = useRecoilState(
    documentViewQueryStore
  );

  const documentQuery = useRef<DocumentViewQuery | null>(null);

  useEffect(() => {
    const closeDocumentQuery = () => {
      setDocumentViewQuery((qs) =>
        qs.filter((q) => q.documentTitle != titleRef.current)
      );
    };
    window.addEventListener(
      CHILD_PARENT_WINDOW_EVENT.closeDocumentQuery,
      closeDocumentQuery
    );
    return () => {
      window.removeEventListener(
        CHILD_PARENT_WINDOW_EVENT.closeDocumentQuery,
        closeDocumentQuery
      );
    };
  }, []);

  documentQuery.current = useMemo(() => {
    return viewQuery.find((v) => v.documentTitle == titleRef.current) || null;
  }, [titleRef.current, viewQuery]);

  useEffect(() => {
    if (documentQuery.current) {
      window.dispatchEvent(
        new Event(PARENT_WINDOW_EVENT.frameDocumentSearchStart)
      );
      iframeRef.current?.contentWindow?.location.reload();
    }
  }, [viewQuery]);

  return {
    viewQuery,
    documentQuery,
  };
};

const useSubjectQuery = (
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>
) => {
  const [subjectItemSelected, setSubjectItemSelected] = useRecoilState(
    selectedSubjectDocumentItemStore
  );

  const subjectItemSelectedRef = useValueStateRef(subjectItemSelected);

  useEffect(() => {
    if (subjectItemSelectedRef.current) {
      iframeRef.current?.contentWindow?.location.reload();
    }
  }, [subjectItemSelected]);

  return {
    subjectItemSelectedRef,
    setSubjectItemSelected,
  };
};

const useSearchQuery = (
  subjectItemSelectedRef: React.MutableRefObject<SubjectDocumentItem | null>,
  setSubjectItemSelected: SetterOrUpdater<SubjectDocumentItem | null>,
  path: string | null,
  documentQuery: React.MutableRefObject<DocumentViewQuery | null>,
  postMessage: (
    iframeEl: HTMLIFrameElement,
    type: string,
    detail: any,
    path: string
  ) => Promise<void>
) => {
  const handleSearchQuery = useCallback(
    (iframeEl: HTMLIFrameElement, hasOwnPosition: boolean) => {
      if (subjectItemSelectedRef.current) {
        postMessage(
          iframeEl,
          POST_MESSAGE_EVENT.subjectItem,
          subjectItemSelectedRef.current,
          path!
        );
        setSubjectItemSelected(null);
      } else if (documentQuery.current) {
        window.dispatchEvent(
          new Event(PARENT_WINDOW_EVENT.frameDocumentSearchStart)
        );
        postMessage(
          iframeEl,
          POST_MESSAGE_EVENT.documentQuery,
          documentQuery.current,
          path!
        );
      } else if (!hasOwnPosition) {
        const container = iframeEl.contentDocument?.getElementById(
          DOCUMENT_CONTAINER_ID
        )?.firstElementChild?.firstElementChild;
        container
          ?.querySelector('div')
          ?.scrollIntoView({ inline: 'center', behavior: 'smooth' });
      }
    },
    []
  );

  return handleSearchQuery;
};

const useDocument = () => {
  const title = useRecoilValue(currentDocumentTabsSelector);
  const titleRef = useValueStateRef(title);

  const iframeRef = useContainerScrollY<HTMLIFrameElement>([window], 40, true);

  const [path, setPath] = useState<string | null>(null);

  // notify main process about the active document on view
  const $titles = useRecoilValue(titlesDocumentSelector);

  useEffect(() => {
    if (!title) return;
    const doc = $titles[title];
    if (doc) sendIpcRequest(IPC_EVENTS.active_document_view, doc.getTitle());
  }, [title, $titles]);

  // get document title path
  useEffect(() => {
    if (title) {
      sendIpcRequest<string>(IPC_EVENTS.document_content_path, title).then(
        (p) => p && setPath(p)
      );
    }
  }, [title]);

  return {
    title,
    titleRef,
    iframeRef,
    path,
    $titles,
  };
};

const useDocumentsState = (titleRef: React.MutableRefObject<string>) => {
  const pageRef = useRef<HTMLElement | null>(null);
  const [tabs, setTabs] = useRecoilState(documentTabsStore);

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

    window.addEventListener(
      CHILD_PARENT_WINDOW_EVENT.documentCurrentZoom,
      documentZoom
    );
    return () => {
      window.addEventListener(
        CHILD_PARENT_WINDOW_EVENT.documentCurrentZoom,
        documentZoom
      );
    };
  }, []);

  return {
    tabs,
    pageRef,
    setTabs,
  };
};

export default function DocumentView() {
  const { iframeRef, path, titleRef, title, $titles } = useDocument();

  const { documentQuery } = useDocumentQuery(titleRef, iframeRef);

  const postMessage = usePostMessage();

  const { subjectItemSelectedRef, setSubjectItemSelected } = useSubjectQuery(
    iframeRef
  );

  const { tabs, setTabs, pageRef } = useDocumentsState(titleRef);

  const handleSearchQuery = useSearchQuery(
    subjectItemSelectedRef,
    setSubjectItemSelected,
    path,
    documentQuery,
    postMessage
  );

  const onIframeLoad = () => {
    if (iframeRef.current) {
      const page = iframeRef.current.contentDocument?.querySelector(
        `#${DOCUMENT_CONTAINER_ID}`
      ) as HTMLElement | null | undefined;

      pageRef.current = page!;

      // post message title datastore
      postMessage(
        iframeRef.current,
        POST_MESSAGE_EVENT.documentTitleData,
        $titles[title].toObject(),
        path!
      );

      // get active tab
      const tab = tabs.find((t) => t.title === title);

      // handle zoom
      //@ts-ignore
      page && (page.style.zoom = (tab?.zoom || 100) + '%');
      if (tab?.zoom) {
        postMessage(
          iframeRef.current,
          POST_MESSAGE_EVENT.documentZoom,
          tab?.zoom,
          path!
        );
      }

      let hasOwnPosition = false;
      if ((tab?.scrollY || tab?.scrollX) && page) {
        hasOwnPosition = true;

        if (!(subjectItemSelectedRef.current || documentQuery.current)) {
          postMessage(
            iframeRef.current,
            POST_MESSAGE_EVENT.windowPosition,
            {
              top: tab.scrollY || undefined,
              left: tab.scrollX || undefined,
            },
            path!
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

      // update document scroll state
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

      // externalizeLinkTag
      const externalizeLinkTag = (event: MouseEvent) => {
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
      };

      page?.addEventListener('click', externalizeLinkTag);
      page?.addEventListener('scroll', debounce(onScroll, 300));
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
      <NoteReferencesModal title={title} />
    </>
  );
}
