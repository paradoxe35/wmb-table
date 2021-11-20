import { Input, message, Modal } from 'antd';
import React, { useEffect } from 'react';
import { useCallback, useRef } from 'react';
import { useSetRecoilState } from 'recoil';
import { documentViewQueryStore } from '@renderer/store';
import { DocumentSearchEvent, DocumentViewQuery } from '@localtypes/index';
import { useValueStateRef } from '@renderer/hooks';
import { SearchOutlined } from '@ant-design/icons';
import { CHILD_PARENT_WINDOW_EVENT } from '@modules/shared/shared';

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
  const searchForParagraph = useRef<boolean>();

  const onSearch = () => {
    const value = searchValue.current;
    if (
      !searchForParagraph.current &&
      (value.trim().length < 3 || documentQueryRef.current?.term == value)
    ) {
      if (value.trim().length < 3) {
        message.warn(
          'Votre recherche doit comporter au moins trois caractères'
        );
      }
      return;
    }

    if (
      searchForParagraph.current &&
      (value.trim().length === 0 || isNaN(+value.trim()))
    ) {
      message.warn('La valeur saisie est invalide');
      return;
    }

    setDocumentViewQuery((docs) => {
      const datas = docs.filter((d) => d.documentTitle != titleRef.current);
      return [
        ...datas,
        {
          documentTitle: titleRef.current,
          matches: [],
          textContentLength: 0,
          searchForParagraph: searchForParagraph.current,
          term: value.trim(),
        },
      ];
    });

    if (searchForParagraph.current) {
      searchValue.current = '';
    }
  };

  const modal = useCallback((event: CustomEventInit<DocumentSearchEvent>) => {
    if (isOpened.current) return;

    if (event.detail?.searchForParagraph) {
      searchValue.current = '';
    }

    searchValue.current = event.detail?.text || searchValue.current;
    searchForParagraph.current = event.detail?.searchForParagraph;

    const modalInstance = Modal.info({
      closable: true,
      icon: null,
      onOk: onSearch,
      okText: <SearchOutlined />,
      title: event.detail?.searchForParagraph
        ? 'Recherche paragraphe'
        : 'Recherche text',
      content: (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
            modalInstance.destroy();
          }}
        >
          <Input
            type={event.detail?.searchForParagraph ? 'number' : 'texte'}
            autoFocus={true}
            size="large"
            minLength={3}
            allowClear
            onKeyUp={(e) => (searchValue.current = e.currentTarget.value)}
            defaultValue={searchValue.current}
            placeholder={
              event.detail?.searchForParagraph
                ? 'Entrez le paragraphe'
                : 'Entrez votre texte'
            }
          />
          <ModalController iframeRef={iframeRef} isOpened={isOpened} />
        </form>
      ),
    });
  }, []);

  useEffect(() => {
    window.addEventListener(CHILD_PARENT_WINDOW_EVENT.openSearchModal, modal);
    return () => {
      window.removeEventListener(
        CHILD_PARENT_WINDOW_EVENT.openSearchModal,
        modal
      );
    };
  }, []);

  return <></>;
}
