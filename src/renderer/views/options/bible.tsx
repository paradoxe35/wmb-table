import {
    Button,
    Collapse,
    Divider,
    Dropdown,
    Input,
    List,
    Menu,
    Pagination,
    Space,
    Spin,
    Typography,
    Select,
} from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import LoadByVisibility from '@renderer/components/load-by-visibility';
import { SearchOutlined, DownOutlined, LoadingOutlined } from '@ant-design/icons';
import { BibleIcons } from '@renderer/components/icons';
import type {
    BibleBook,
    BibleIndex,
    BibleIndexValue,
    BibleSearchItem,
    BibleSearchResult,
    BookRequest,
    SubjectRefTree,
} from '@shared/types';
import { debounce } from '@renderer/utils/functions';
import ContainerScrollY from '@renderer/components/container-scroll-y';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';

const TESTAMENTS = [
    { name: 'Nouveau Testament', value: 'N' },
    { name: 'Ancien Testament', value: 'O' },
];

type Testament = (typeof TESTAMENTS)[0];

export default function Bible() {
    const [menu, setMenu] = useState('bible');

    const handleClick = (e: { key: string }) => setMenu(e.key);

    return (
        <LoadByVisibility>
            <Menu onClick={handleClick} selectedKeys={[menu]} mode="horizontal">
                <Menu.Item key="bible" icon={<BibleIcons />}>
                    Bible
                </Menu.Item>
                <Menu.Item key="search" icon={<SearchOutlined />}>
                    Recherche
                </Menu.Item>
            </Menu>
            <div className="mt-2 mb-3" />
            <div hidden={menu !== 'bible'}>
                <ContainerScrollY>
                    <BibleContent verseMetaContent={true} />
                </ContainerScrollY>
            </div>
            <div hidden={menu !== 'search'}>
                <ContainerScrollY className="bible-search-content">
                    <SearchContent />
                </ContainerScrollY>
            </div>
        </LoadByVisibility>
    );
}

function AddToSubject({ verse }: { verse: BibleBook }) {
    const handler = useCallback(() => {
        window.dispatchEvent(
            new CustomEvent<Partial<SubjectRefTree>>(
                CHILD_PARENT_WINDOW_EVENT.addDocumentRefSubject,
                { detail: { bible: verse } },
            ),
        );
    }, [verse]);

    return (
        <Dropdown
            menu={{
                items: [{ key: 'add', label: 'Ajouter à un sujet', onClick: handler }],
            }}
            placement="bottomRight"
            arrow
            trigger={['click']}
        >
            <Button>
                <DownOutlined />
            </Button>
        </Dropdown>
    );
}

function BookContent({
    bookDetail,
    onClick,
    verseMetaContent,
}: {
    bookDetail: BibleIndexValue;
    onClick?: (id: string) => void;
    verseMetaContent?: boolean;
}) {
    const [chaptersKey, setChaptersKey] = useState(1);
    const [verses, setVerses] = useState<BibleBook[]>();

    useEffect(() => {
        (
            window.api.bible.getBooks({
                book: bookDetail.book,
                chapter: chaptersKey.toString(),
            } as BookRequest) as Promise<BibleBook[]>
        ).then(setVerses);
    }, [chaptersKey, bookDetail.book]);

    return (
        <Collapse activeKey="1" accordion>
            <Collapse.Panel
                header={
                    <Space wrap={true} direction="horizontal">
                        {new Array(+bookDetail.chapters).fill(null).map((_, i) => {
                            const key = i + 1;
                            return (
                                <Button
                                    onClick={() => setChaptersKey(key)}
                                    key={key}
                                    type={key === chaptersKey ? 'primary' : 'dashed'}
                                >
                                    {i + 1}
                                </Button>
                            );
                        })}
                    </Space>
                }
                key="1"
            >
                {(!verses || verses.length === 0) && (
                    <div className="flex flex-center">
                        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                    </div>
                )}
                {verses && verses.length > 0 && (
                    <List
                        itemLayout="horizontal"
                        dataSource={verses.sort((a, b) => +a.verse - +b.verse)}
                        renderItem={(item) => {
                            const onClickItem = () => onClick?.(item.id);
                            return (
                                <List.Item
                                    className={`verse-item ${onClick ? 'list__clickable' : ''}`}
                                    actions={[
                                        verseMetaContent && (
                                            <span className="verse-action" key="0">
                                                <AddToSubject verse={item} />
                                            </span>
                                        ),
                                    ]}
                                    onClick={onClickItem}
                                    key={item.id}
                                >
                                    <List.Item.Meta
                                        avatar={<span>{item.verse}.</span>}
                                        description={
                                            <Typography.Text className="content-description">
                                                {item.content}
                                            </Typography.Text>
                                        }
                                    />
                                </List.Item>
                            );
                        }}
                    />
                )}
            </Collapse.Panel>
        </Collapse>
    );
}

function BibleTestamentContent({
    bibleIndex,
    onClick,
    verseMetaContent,
}: {
    bibleIndex: BibleIndex;
    onClick?: (id: string) => void;
    verseMetaContent?: boolean;
}) {
    const [currentKey, setCurrentKey] = useState<string>();

    function onChangeKey(key: string | string[]) {
        if (typeof key === 'string') setCurrentKey(key);
    }

    useEffect(() => {
        if (currentKey) {
            document
                .getElementById(`book-${currentKey}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentKey]);

    return (
        <Collapse onChange={onChangeKey} accordion>
            {bibleIndex &&
                Object.keys(bibleIndex).map((key) => {
                    const book = bibleIndex[key];
                    return (
                        <Collapse.Panel id={`book-${book.book}`} header={key} key={book.book}>
                            {currentKey === book.book && (
                                <BookContent
                                    verseMetaContent={verseMetaContent}
                                    onClick={onClick}
                                    bookDetail={book}
                                />
                            )}
                        </Collapse.Panel>
                    );
                })}
        </Collapse>
    );
}

export function BibleContent({
    onClick,
    verseMetaContent,
}: {
    onClick?: (id: string) => void;
    verseMetaContent?: boolean;
}) {
    const [bibleIndex, setBibleIndex] = useState<Record<string, BibleIndex>>({});

    useEffect(() => {
        (window.api.bible.getIndexes() as Promise<Record<string, BibleIndex>>).then((indexs) => {
            setBibleIndex(indexs || {});
        });
    }, []);

    return (
        <>
            <Space direction="vertical" style={{ width: '100%' }}>
                {Object.keys(bibleIndex).map((key) => (
                    <Space direction="vertical" style={{ width: '100%' }} key={key}>
                        <Typography.Title type="secondary" level={5}>
                            {key === 'N' ? 'Nouveau' : 'Ancien'} Testament
                        </Typography.Title>
                        <BibleTestamentContent
                            key={key}
                            verseMetaContent={verseMetaContent}
                            onClick={onClick}
                            bibleIndex={bibleIndex[key]}
                        />
                    </Space>
                ))}
            </Space>
            <div className="mt-2 mb-2" />
        </>
    );
}

function SearchContent() {
    const [results, setResults] = useState<BibleSearchResult | null>(null);
    const lastSearch = useRef<string>('');
    const testament = useRef<Testament | undefined>(undefined);

    const onPageChange = useCallback((page: number) => {
        (
            window.api.bible.search(lastSearch.current.trim(), page) as Promise<BibleSearchResult>
        ).then((datas) => {
            document
                .querySelector('.bible-search-content')
                ?.scrollTo({ top: 0, behavior: 'smooth' });
            setResults(datas);
        });
    }, []);

    return (
        <>
            <div className="flex flex-center">
                <InputSearchBible
                    testament={testament}
                    setResults={setResults}
                    lastSearch={lastSearch}
                />
            </div>
            <SearchResult onPageChange={onPageChange} results={results} />
        </>
    );
}

function SearchResult({
    results,
    onPageChange,
}: {
    results: BibleSearchResult | null;
    onPageChange?: (page: number) => void;
}) {
    return (
        <>
            {results && (
                <div className="mt-2 flex flex-center">
                    <Typography.Text type="secondary">
                        Trouvé dans {results.total} verset{results.total > 1 ? 's' : ''}, page(
                        {results.pageNumber}/{Math.ceil(results.total / results.itemsPerPage)})
                    </Typography.Text>
                </div>
            )}
            <div className="mt-2 flex flex-center">
                <List
                    itemLayout="vertical"
                    size="large"
                    style={{ width: '100%' }}
                    pagination={false}
                    dataSource={results?.data || []}
                    renderItem={(result) => (
                        <>
                            <List.Item key={result.item.id}>
                                <List.Item.Meta
                                    title={
                                        <span>
                                            {result.item.bookName} {result.item.chapter}:
                                            {result.item.verse}
                                        </span>
                                    }
                                />
                                <ContentItem item={result} />
                            </List.Item>
                            <Divider />
                        </>
                    )}
                />
            </div>
            {results && (
                <div className="mt-2 flex flex-center mb-2">
                    <Pagination
                        key={results.query}
                        onChange={onPageChange}
                        defaultCurrent={results.pageNumber}
                        showSizeChanger={false}
                        total={results.total}
                    />
                </div>
            )}
        </>
    );
}

const ContentItem = ({ item }: { item: BibleSearchItem }) => {
    const parentRef = useRef<HTMLSpanElement | null>(null);

    useEffect(() => {
        if (parentRef.current) {
            const element = parentRef.current;
            const node = document.createTextNode(item.item.content);
            element.appendChild(node);

            const matcher = item.matches[0];
            if (matcher?.start != null && matcher?.end != null) {
                const range = document.createRange();
                const tag = document.createElement('mark');
                range.setStart(node, matcher.start);
                range.setEnd(node, matcher.end);
                range.surroundContents(tag);
            }
        }
    }, [item]);

    return <span className="content-description-2" ref={parentRef}></span>;
};

function InputSearchBible({
    setResults,
    lastSearch,
    testament,
}: {
    setResults: React.Dispatch<React.SetStateAction<BibleSearchResult | null>>;
    lastSearch: React.MutableRefObject<string>;
    testament: React.MutableRefObject<Testament | undefined>;
}) {
    const [loading, setLoading] = useState(false);

    const handleSearch = useCallback(
        (value: string) => {
            if (!value || value.length < 3) return;
            lastSearch.current = value;
            setLoading(true);
            (window.api.bible.search(value, 1) as Promise<BibleSearchResult>)
                .then(setResults)
                .finally(() => setLoading(false));
        },
        [lastSearch, setResults],
    );

    const onTestamentChange = (value: string | undefined) => {
        testament.current = TESTAMENTS.find((t) => t.value === value);
    };

    return (
        <Space>
            <Input.Search
                style={{ width: 300 }}
                size="large"
                minLength={3}
                allowClear
                loading={loading}
                placeholder="Faites vos recherches biblique ici"
                enterButton
                onSearch={debounce(handleSearch, 100)}
            />
            <Select
                style={{ minWidth: 170 }}
                size="large"
                placeholder="Testaments"
                className="w-100 max-w-100"
                onChange={onTestamentChange}
                allowClear
            >
                {TESTAMENTS.map((t) => (
                    <Select.Option key={t.value} value={t.value}>
                        {t.name}
                    </Select.Option>
                ))}
            </Select>
        </Space>
    );
}
