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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import LoadByVisibility from '@renderer/components/load-by-visibility';
import { SearchOutlined, DownOutlined } from '@ant-design/icons';
import { BibleIcons } from '@renderer/components/icons';
import {
  BibleBook,
  BibleIndex,
  BibleIndexValue,
  BibleSearchItem,
  BibleSearchResult,
  BookRequest,
  SubjectRefTree,
} from '@localtypes/index';
import sendIpcRequest from '@root/ipc/ipc-renderer';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import { LoadingOutlined } from '@ant-design/icons';
import { debounce } from '@root/utils/functions';
import ContainerScrollY from '@renderer/components/container-scroll-y';
import { CHILD_PARENT_WINDOW_EVENT } from '@modules/shared/shared';

const { Option } = Select;

const TESTAMENTS = [
  {
    name: 'Nouveau Testament',
    value: 'N',
  },
  {
    name: 'Ancien Testament',
    value: 'O',
  },
];

type Testament = typeof TESTAMENTS[0];

export default function Bible() {
  const [menu, setMenu] = useState('bible');

  const handleClick = (e: any) => {
    setMenu(e.key);
  };

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
        {
          detail: {
            bible: verse,
          },
        }
      )
    );
  }, []);
  return (
    <Dropdown
      overlay={
        <Menu>
          <Menu.Item onClick={handler}>Ajouter à un sujet</Menu.Item>
        </Menu>
      }
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
    sendIpcRequest<BibleBook[]>(IPC_EVENTS.bible_books, {
      book: bookDetail.book,
      chapter: chaptersKey.toString(),
    } as BookRequest).then((books) => setVerses(books));
  }, [chaptersKey]);

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
                  type={key == chaptersKey ? 'primary' : 'dashed'}
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
            <Spin
              indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
            />
          </div>
        )}
        {verses && verses.length > 0 && (
          <List
            itemLayout="horizontal"
            dataSource={verses.sort((a, b) => +a.verse - +b.verse)}
            renderItem={(item) => {
              const onClickItem = () => onClick && onClick(item._id);
              return (
                <List.Item
                  className={`verse-item ${onClick ? 'list__clickable' : ''}`}
                  actions={[
                    verseMetaContent && (
                      <span className="verse-action" key="0">
                        {<AddToSubject verse={item} />}
                      </span>
                    ),
                  ]}
                  onClick={onClickItem}
                  key={item._id}
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
    if (typeof key === 'string') {
      setCurrentKey(key);
    }
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
            <Collapse.Panel
              id={`book-${book.book}`}
              header={key}
              key={book.book}
            >
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
  const [bibleIndex, setBibleIndex] = useState<{ [name: string]: BibleIndex }>(
    {}
  );

  useEffect(() => {
    sendIpcRequest<{ [name: string]: BibleIndex }>(
      IPC_EVENTS.bible_indexes
    ).then((indexs) => {
      setBibleIndex(indexs || {});
    });
  }, []);

  return (
    <>
      <Space direction="vertical" style={{ width: '100%' }}>
        {bibleIndex &&
          Object.keys(bibleIndex).map((key) => {
            return (
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
            );
          })}
      </Space>
      <div className="mt-2 mb-2" />
    </>
  );
}

function SearchContent() {
  const [results, setResults] = useState<BibleSearchResult | null>(null);
  const lastSearch = useRef<string>('');

  const testament = useRef<Testament>();

  const onPageChange = useCallback((page: number) => {
    sendIpcRequest<BibleSearchResult>(
      IPC_EVENTS.bible_search,
      lastSearch.current.trim(),
      page,
      testament.current?.value
    ).then((datas) => {
      const lc = document.querySelector('.bible-search-content');
      lc && lc.scrollTo({ top: 0, behavior: 'smooth' });
      setResults(datas);
    });
  }, []);

  return (
    <>
      <div className="flex flex-center">
        <InputSearch
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
  onPageChange?:
    | ((page: number, pageSize?: number | undefined) => void)
    | undefined;
}) {
  return (
    <>
      {results && (
        <div className="mt-2 flex flex-center">
          <Typography.Text type="secondary">
            Trouvé dans {results?.total} verset
            {results?.total > 1 ? 's' : ''}, page({results.pageNumber}/
            {Math.ceil(results.total / results.itemsPerPage)})
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
              <List.Item key={result.item._id}>
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

      if (matcher && matcher.start && matcher.end) {
        const range = document.createRange();
        const tag = document.createElement('mark');
        const rangeStart = matcher.start;
        const rangeEnd = matcher.end;

        range.setStart(node, rangeStart);
        range.setEnd(node, rangeEnd);
        range.surroundContents(tag);
      }
    }
  }, []);

  return <span className="content-description-2" ref={parentRef}></span>;
};

function InputSearch({
  setResults,
  lastSearch,
  testament,
}: {
  setResults: React.Dispatch<React.SetStateAction<BibleSearchResult | null>>;
  lastSearch: React.MutableRefObject<string>;
  testament: React.MutableRefObject<Testament | undefined>;
}) {
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback((value: string) => {
    if (!value || value.length < 3) return;
    lastSearch.current = value;
    setLoading(true);
    sendIpcRequest<BibleSearchResult>(
      IPC_EVENTS.bible_search,
      value,
      undefined,
      testament.current?.value
    )
      .then((data) => setResults(data))
      .finally(() => setLoading(false));
  }, []);

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
        {TESTAMENTS.map((testament) => {
          return (
            <Option key={testament.value} value={testament.value}>
              {testament.name}
            </Option>
          );
        })}
      </Select>
    </Space>
  );
}
