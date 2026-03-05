import { Input, message, Modal } from 'antd';
import { useCallback, useEffect, useRef } from 'react';
import { DocumentSearchEvent, DocumentViewQuery } from '@shared/types';
import { useValueStateRef } from '@renderer/hooks';
import { SearchOutlined, FileSearchOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';
import { useSearchStore } from '@renderer/stores';

export function ModalSearchDocument({ title }: { title: string }) {
    const titleRef = useValueStateRef<string>(title);

    const documentViewQueries = useSearchStore((s) => s.documentViewQueries);
    const setDocumentViewQueries = useSearchStore((s) => s.setDocumentViewQueries);

    const documentQuery = documentViewQueries.find((q) => q.documentTitle === title) ?? null;
    const documentQueryRef = useValueStateRef<DocumentViewQuery | null>(documentQuery);

    const searchValue = useValueStateRef<string>(documentQuery?.term || '');

    const isOpened = useRef(false);
    const searchForParagraph = useRef<boolean | undefined>(undefined);

    const onSearch = () => {
        const value = searchValue.current;
        if (
            !searchForParagraph.current &&
            (value.trim().length < 3 || documentQueryRef.current?.term == value)
        ) {
            if (value.trim().length < 3) {
                message.warning('Votre recherche doit comporter au moins trois caractères');
            }
            return;
        }

        if (searchForParagraph.current && (value.trim().length === 0 || isNaN(+value.trim()))) {
            message.warning('La valeur saisie est invalide');
            return;
        }

        setDocumentViewQueries((docs) => {
            const datas = docs.filter((d) => d.documentTitle != titleRef.current);
            return [
                ...datas,
                {
                    documentTitle: titleRef.current,
                    matches: [],
                    textContentLength: 0,
                    searchForParagraph: searchForParagraph.current ?? false,
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

        isOpened.current = true;

        const modalInstance = Modal.info({
            closable: true,
            icon: null,
            onOk: onSearch,
            okText: <SearchOutlined />,
            afterClose: () => {
                isOpened.current = false;
            },
            title: (
                <span>
                    {event.detail?.searchForParagraph ? 'Recherche paragraphe' : 'Recherche text'}{' '}
                    {event.detail?.searchForParagraph ? (
                        <SortAscendingOutlined />
                    ) : (
                        <FileSearchOutlined />
                    )}
                </span>
            ),
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
                </form>
            ),
        });
    }, []);

    useEffect(() => {
        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.openSearchModal, modal);
        return () => {
            window.removeEventListener(CHILD_PARENT_WINDOW_EVENT.openSearchModal, modal);
        };
    }, []);

    return <></>;
}
