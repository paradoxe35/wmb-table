import { Input, Modal } from 'antd';
import React, { useEffect } from 'react';
import { useCallback, useRef } from 'react';
import { useSetRecoilState } from 'recoil';
import { documentViewQueryStore } from '../../store';
import { DocumentViewQuery } from '../../types';
import { useValueStateRef } from '../../utils/hooks';
import { SearchOutlined } from '@ant-design/icons';

const ModalController = ({
  isOpened,
  iframeRef,
}: {
  isOpened: React.MutableRefObject<boolean>;
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
}) => {
  useEffect(() => {
    isOpened.current = true;
    return () => {
      iframeRef.current?.contentWindow?.focus();
      isOpened.current = false;
    };
  });
  return <> </>;
};

export function ModalSearchDocument({
  documentQuery,
  title,
  iframeRef,
}: {
  documentQuery: DocumentViewQuery | null;
  title: string;
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
}) {
  const titleRef = useValueStateRef<string>(title);

  const documentQueryRef = useValueStateRef<DocumentViewQuery | null>(
    documentQuery
  );

  const searchValue = useValueStateRef<string>(documentQuery?.term || '');

  const setDocumentViewQuery = useSetRecoilState(documentViewQueryStore);

  const isOpened = useRef(false);

  const onSearch = () => {
    if (
      searchValue.current.trim().length < 3 ||
      documentQueryRef.current?.term == searchValue.current
    ) {
      return;
    }
    setDocumentViewQuery((docs) => {
      const datas = docs.filter((d) => d.documentTitle != titleRef.current);
      return [
        ...datas,
        {
          documentTitle: titleRef.current,
          matches: [],
          term: searchValue.current.trim(),
        },
      ];
    });
  };

  const modal = useCallback((event: CustomEventInit<string | null>) => {
    if (isOpened.current) return;

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
            autoFocus={true}
            size="large"
            minLength={3}
            allowClear
            onKeyUp={(e) => (searchValue.current = e.currentTarget.value)}
            defaultValue={event?.detail || searchValue.current}
            placeholder="Entrez votre texte"
          />
          <ModalController iframeRef={iframeRef} isOpened={isOpened} />
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
