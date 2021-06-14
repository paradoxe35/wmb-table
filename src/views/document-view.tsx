import React, { useCallback, useEffect, useRef, useState } from 'react';
import DocumentTabs from '../components/document-tabs';
import { Input, Layout } from 'antd';
import { currentDocumentTabs, documentTabs, documentViewQuery } from '../store';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import sendIpcRequest from '../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../utils/ipc-events';
import { useContainerScrollY, useValueStateRef } from '../utils/hooks';
import { debounce } from '../utils/functions';
import { DocumentViewQuery } from '../types';
import { Modal } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const { Content } = Layout;

function ModalSearchDocument({
  documentQuery,
}: {
  documentQuery: DocumentViewQuery | null;
}) {
  const documentQueryRef = useValueStateRef<DocumentViewQuery | null>(
    documentQuery
  );
  const searchValue = useValueStateRef<string>(documentQuery?.term || '');
  const setDocumentViewQuery = useSetRecoilState(documentViewQuery);

  const onSearch = () => {
    if (
      searchValue.current.trim().length < 3 ||
      documentQueryRef.current?.term == searchValue.current
    ) {
      return;
    }
    setDocumentViewQuery((docs) => {
      const datas = docs.filter(
        (d) => d.documentTitle != documentQueryRef.current?.documentTitle
      );
      return [
        ...datas,
        {
          documentTitle: documentQueryRef.current?.documentTitle as string,
          matches: [],
          term: searchValue.current.trim(),
        },
      ];
    });
  };

  const modal = useCallback(() => {
    const modalInstance = Modal.info({
      closable: true,
      icon: null,
      onOk: onSearch,
      okText: <SearchOutlined />,
      title: 'Recherche',
      content: (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
            modalInstance.destroy();
          }}
        >
          <Input
            size="large"
            minLength={3}
            allowClear
            onKeyUp={(e) => (searchValue.current = e.currentTarget.value)}
            defaultValue={searchValue.current}
            placeholder="Entrez votre texte"
          />
        </form>
      ),
    });
  }, []);

  useEffect(() => {
    window.addEventListener('open-search-modal', modal);
    return () => {
      window.removeEventListener('open-search-modal', modal);
    };
  }, []);

  return <></>;
}

export default function DocumentView() {
  const title = useRecoilValue(currentDocumentTabs);

  const [path, setPath] = useState<string | null>(null);

  const iframeRef = useContainerScrollY<HTMLIFrameElement>([window], 40, true);

  const [tabs, setTabs] = useRecoilState(documentTabs);

  const viewQuery = useRecoilValue(documentViewQuery);

  const documentQuery = useRef<DocumentViewQuery | null>(null);

  useEffect(() => {
    const query = viewQuery.find((v) => v.documentTitle == title);
    if (query) {
      documentQuery.current = query;
    } else {
      documentQuery.current = null;
    }
  }, [title, viewQuery]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.location.reload();
  }, [viewQuery]);

  useEffect(() => {
    sendIpcRequest<string>(IPC_EVENTS.document_content_path, title).then((p) =>
      setPath(p)
    );
  }, [title]);

  const handleSearchQuery = (iframeEl: HTMLIFrameElement) => {
    if (documentQuery.current && path) {
      window.setTimeout(() => {
        iframeEl.contentWindow?.postMessage(
          { type: 'document-query', detail: documentQuery.current },
          path
        );
      }, 1000);
    }
  };

  const onIframeLoad = () => {
    if (iframeRef.current) {
      const page = iframeRef.current.contentDocument?.querySelector(
        '#page-container'
      );

      const tab = tabs.find((t) => t.title === title);

      if (tab?.scrollY && page) {
        page.scrollTop = tab.scrollY;
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
            nt.title === title && (nt.scrollY = page?.scrollTop);
            return nt;
          });
        });
      };

      page?.addEventListener('scroll', debounce(onScroll, 1000));
      handleSearchQuery(iframeRef.current);
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
      <ModalSearchDocument documentQuery={documentQuery.current} />
    </>
  );
}
