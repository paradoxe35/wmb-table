import {
  Button,
  Collapse,
  Divider,
  Input,
  List,
  Menu,
  Pagination,
  Space,
  Spin,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import LoadByVisibility from '../../components/load-by-visibility';
import { SearchOutlined } from '@ant-design/icons';
import { BibleIcons } from '../../components/icons';
import {
  BibleBook,
  BibleIndex,
  BibleIndexValue,
  BibleSearchItem,
  BibleSearchResult,
  BookRequest,
} from '../../types';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../../utils/ipc-events';
import { LoadingOutlined } from '@ant-design/icons';
import { debounce } from '../../utils/functions';

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
        <BibleContent />
      </div>
      <div hidden={menu !== 'search'}>
        <SearchContent />
      </div>
    </LoadByVisibility>
  );
}

function BookContent({
  bookDetail,
  onClick,
}: {
  bookDetail: BibleIndexValue;
  onClick?: (id: string) => void;
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
                  className={onClick ? 'list__clickable' : undefined}
                  onClick={onClickItem}
                  key={item._id}
                >
                  <List.Item.Meta
                    avatar={<span>{item.verse}.</span>}
                    description={
                      <Typography.Text style={{ fontSize: '1.2em' }}>
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
}: {
  bibleIndex: BibleIndex;
  onClick?: (id: string) => void;
}) {
  const [currentKey, setCurrentKey] = useState<string>();

  function onChangeKey(key: string | string[]) {
    setCurrentKey(key as string);
  }

  return (
    <Collapse onChange={onChangeKey} accordion>
      {bibleIndex &&
        Object.keys(bibleIndex).map((key) => {
          const book = bibleIndex[key];
          return (
            <Collapse.Panel header={key} key={book.book}>
              {currentKey === book.book && (
                <BookContent onClick={onClick} bookDetail={book} />
              )}
            </Collapse.Panel>
          );
        })}
    </Collapse>
  );
}

export function BibleContent({ onClick }: { onClick?: (id: string) => void }) {
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

  const onPageChange = useCallback((page: number) => {
    sendIpcRequest<BibleSearchResult>(
      IPC_EVENTS.bible_search,
      lastSearch.current.trim(),
      page
    ).then((datas) => {
      const lc = document.querySelector('.site-layout-content');
      lc && lc.scrollTo({ top: 0, behavior: 'smooth' });
      setResults(datas);
    });
  }, []);

  return (
    <>
      <div className="flex flex-center">
        <InputSearch setResults={setResults} lastSearch={lastSearch} />
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

  return <span ref={parentRef}></span>;
};

function InputSearch({
  setResults,
  lastSearch,
}: {
  setResults: React.Dispatch<React.SetStateAction<BibleSearchResult | null>>;
  lastSearch: React.MutableRefObject<string>;
}) {
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback((value: string) => {
    if (!value || value.length < 3) return;
    lastSearch.current = value;
    setLoading(true);
    sendIpcRequest<BibleSearchResult>(IPC_EVENTS.bible_search, value)
      .then((data) => setResults(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Input.Search
      style={{ width: 400 }}
      size="large"
      minLength={3}
      allowClear
      loading={loading}
      placeholder="Faites vos recherches biblique ici"
      enterButton
      onSearch={debounce(handleSearch, 100)}
    />
  );
}
