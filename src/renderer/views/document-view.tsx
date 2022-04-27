import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import DocumentTabs from '../components/document-tabs';
import { Layout, message } from 'antd';
import {
  currentAudioDocumentPlayStore,
  currentDocumentTabsSelector,
  documentTabsStore,
  documentViewQueryStore,
  selectedSubjectDocumentItemStore,
} from '@renderer/store';
import { SetterOrUpdater, useRecoilState, useRecoilValue } from 'recoil';
import sendIpcRequest from '@root/ipc/ipc-renderer';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import {
  useContainerScrollY,
  useDocumentTitle,
  useValueStateRef,
} from '@renderer/hooks';
import { debounce } from '@root/utils/functions';
import { DocumentViewQuery, SubjectDocumentItem } from '@localtypes/index';
import { ModalSearchDocument } from './components/modals/modal-search-document';
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
  const waitForDocumentViewStarted = useCallback((callback: Function) => {
    return new Promise<any>((resolve) => {
      window.addEventListener(
        CHILD_PARENT_WINDOW_EVENT.documentViewLoaded,
        resolve,
        {
          once: true,
        }
      );
      callback();
    });
  }, []);

  const postMessage = useCallback(
    async (
      iframeEl: HTMLIFrameElement,
      type: string,
      detail: any,
      path: string
    ) => {
      await waitForDocumentViewStarted(() => {
        iframeEl.contentWindow?.dispatchEvent(
          new Event(POST_MESSAGE_EVENT.requestForPostMessage)
        );
      });
      iframeEl.contentWindow?.postMessage({ type, detail }, 'file:///' + path);
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

  useEffect(() => {
    window.addEventListener(CHILD_PARENT_WINDOW_EVENT.emptySearchquery, () =>
      message.warn('Aucun résultat trouvé')
    );
  }, []);

  return handleSearchQuery;
};

const useDocument = () => {
  const title = useRecoilValue(currentDocumentTabsSelector);
  const titleRef = useValueStateRef(title);

  const iframeRef = useContainerScrollY<HTMLIFrameElement>([window], 40, true);

  const [path, setPath] = useState<string | null>(null);

  // notify main process about the active document on view
  const { $titles } = useDocumentTitle();

  useEffect(() => {
    if (!title) return;
    const doc = $titles[title];
    if (doc) sendIpcRequest(IPC_EVENTS.active_document_view, doc.getTitle());
  }, [title, $titles]);

  // get document title path
  useEffect(() => {
    if (title) {
      sendIpcRequest<string>(IPC_EVENTS.document_content_path, title).then(
        (p) => p && setPath(p.replaceAll('#', '%23'))
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

const useOpenDocumentExternalLink = () => {
  useEffect(() => {
    const openLink = (event: CustomEventInit<string>) => {
      shell.openExternal(event.detail!);
    };

    window.addEventListener(
      CHILD_PARENT_WINDOW_EVENT.openDocumentExternalLink,
      openLink
    );

    return () => {
      window.removeEventListener(
        CHILD_PARENT_WINDOW_EVENT.openDocumentExternalLink,
        openLink
      );
    };
  }, []);
};

const useToPostMessageCurrentAudioDocumentPlay = (
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>,
  title: string,
  path: string | null
) => {
  const postMessage = usePostMessage();

  const currentAudioDocumentPlay = useRecoilValue(
    currentAudioDocumentPlayStore
  );

  useEffect(() => {
    if (
      currentAudioDocumentPlay &&
      iframeRef.current &&
      path &&
      title === currentAudioDocumentPlay.documentTitle
    ) {
      postMessage(
        iframeRef.current,
        POST_MESSAGE_EVENT.currentAudioDocumentPlay,
        currentAudioDocumentPlay,
        path
      );
    }
  }, [currentAudioDocumentPlay, path]);

  const currentAudioPlayOnLoadDocument = useCallback(() => {
    if (title === currentAudioDocumentPlay?.documentTitle) {
      postMessage(
        iframeRef.current!,
        POST_MESSAGE_EVENT.currentAudioDocumentPlay,
        currentAudioDocumentPlay,
        path!
      );
    }
  }, [path, currentAudioDocumentPlay]);

  return currentAudioPlayOnLoadDocument;
};

function useAlertFromIframe() {
  useEffect(() => {
    const noSelectableDocumentText = () => {
      message.warn("Aucun texte n'a été sélectionné pour référence");
    };

    window.addEventListener(
      CHILD_PARENT_WINDOW_EVENT.noSelectableDocumentText,
      noSelectableDocumentText
    );
  }, []);
}

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

  useOpenDocumentExternalLink();

  useAlertFromIframe();

  const currentAudioPlayOnLoadDocument = useToPostMessageCurrentAudioDocumentPlay(
    iframeRef,
    title,
    path
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
      if (tab?.zoom) {
        postMessage(
          iframeRef.current,
          POST_MESSAGE_EVENT.documentZoom,
          tab?.zoom,
          path!
        );
      }
      //@ts-ignore
      page && (page.style.zoom = (tab?.zoom || 100) + '%');

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
        count: !hasOwnPosition ? 1 : 0,
      };

      // update document scroll state
      const onScroll = (): number | void => {
        if (load.count === 0) {
          return (load.count = 1);
        }
        setImmediate(() => {
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
      page?.addEventListener('scroll', debounce(onScroll, 500));
      handleSearchQuery(iframeRef.current, hasOwnPosition);
      currentAudioPlayOnLoadDocument();
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
    </>
  );
}
