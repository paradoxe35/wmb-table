import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Input,
  AutoComplete,
  Typography,
  List,
  Divider,
  Pagination,
} from 'antd';
import { SelectProps } from 'antd/es/select';
import { regexpMatcher, strNormalize } from '../../utils/functions';
import { SearchItem, SearchResult, Suggestions } from '../../types';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../../utils/ipc-events';
import DocumentViewer from '../../components/viewer/document-viewer';
import { useSetRecoilState } from 'recoil';
import { documentViewQuery } from '../../store';

const { Text } = Typography;

type SearchFn = {
  onSearch: (value: string) => void;
  loading: boolean;
  lastSearch: React.MutableRefObject<string>;
  results: SearchResult | null;
  onPageChange: (page: any) => void;
  hasNewResult: React.MutableRefObject<number>;
};

type InputSearchType = {
  onSearch: (value: string) => void;
  loading: boolean;
  suggestions: React.MutableRefObject<Suggestions[]>;
};

function InputSearch({ onSearch, loading, suggestions }: InputSearchType) {
  const [options, setOptions] = useState<SelectProps<object>['options']>([]);
  const handleSearchAutoComplete = (value: string) => {
    setOptions(value ? searchSuggestions(value, suggestions.current) : []);
  };

  return (
    <AutoComplete
      dropdownMatchSelectWidth={252}
      style={{ width: 300 }}
      options={options}
      onSelect={onSearch}
      onSearch={handleSearchAutoComplete}
    >
      <Input.Search
        size="large"
        minLength={3}
        allowClear
        loading={loading}
        placeholder="Faites vos recherches ici"
        enterButton
        onPressEnter={(e) => onSearch(e.currentTarget.value)}
        onSearch={onSearch}
      />
    </AutoComplete>
  );
}

const useSearch = (): SearchFn => {
  const lastSearch = useRef<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const hasNewResult = useRef(0);

  const onSearch = (value: string) => {
    if (value.trim().length < 3 || lastSearch.current == value) {
      return;
    }
    lastSearch.current = value;
    setLoading(true);
    sendIpcRequest<SearchResult>(IPC_EVENTS.search_text, value.trim())
      .then((datas) => {
        hasNewResult.current += 1;
        setResults(datas);
      })
      .finally(() => setLoading(false));
  };

  const onPageChange = useCallback((page: number) => {
    sendIpcRequest<SearchResult>(
      IPC_EVENTS.search_text,
      lastSearch.current.trim(),
      page
    ).then((datas) => {
      const lc = document.querySelector('.site-layout-content');
      lc && lc.scrollTo({ top: 0, behavior: 'smooth' });
      setResults(datas);
    });
  }, []);

  return { onSearch, loading, results, onPageChange, lastSearch, hasNewResult };
};

export default function Search() {
  const suggestions = useRef<Suggestions[]>([]);

  const {
    loading,
    onSearch,
    results,
    lastSearch,
    hasNewResult,
    onPageChange,
  } = useSearch();

  useEffect(() => {
    const can =
      lastSearch.current.trim().length > 0 && !!results && results.total > 0;

    sendIpcRequest<Suggestions[]>(
      IPC_EVENTS.search_suggestions,
      can
        ? ({
            searchText: lastSearch.current.trim(),
            found: results?.total,
          } as Suggestions)
        : undefined
    ).then((suggests) => (suggestions.current = suggests));
  }, [hasNewResult.current]);

  return (
    <>
      <div className="flex-center flex">
        <InputSearch
          onSearch={onSearch}
          loading={loading}
          suggestions={suggestions}
        />
      </div>
      <SearchResultComponent results={results} onPageChange={onPageChange} />
    </>
  );
}

const ListView = ({ result, query }: { result: SearchItem; query: string }) => {
  const setDocumentViewQuery = useSetRecoilState(documentViewQuery);

  const handleDocumentClick = useCallback(() => {
    setDocumentViewQuery((docs) => {
      const datas = docs.filter((d) => d.documentTitle != result.item.title);
      return [
        ...datas,
        {
          documentTitle: result.item.title,
          matches: result.matches,
          term: query,
        },
      ];
    });
  }, [result, setDocumentViewQuery, query]);

  return (
    <>
      <List.Item key={result.item.title}>
        <List.Item.Meta
          title={
            <a>
              <DocumentViewer
                onItemClick={handleDocumentClick}
                name={result.item.title}
                id={result.item._id as string}
              >
                {result.item.title}
              </DocumentViewer>
            </a>
          }
          description={
            <span>{result.matches.length} correspondances trouvées.</span>
          }
        />
        <ContentItem key={result.item.title} item={result} />
      </List.Item>
      <Divider />
    </>
  );
};

const SearchResultComponent = React.memo(
  ({
    results,
    onPageChange,
  }: {
    results: SearchResult | null;
    onPageChange?:
      | ((page: number, pageSize?: number | undefined) => void)
      | undefined;
  }) => {
    return (
      <>
        {results && (
          <div className="mt-2 flex flex-center">
            <Text type="secondary">
              Environ {results?.total} résultats, page({results.pageNumber}/
              {Math.ceil(results.total / results.itemsPerPage)})
            </Text>
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
              <ListView result={result} query={results?.query as string} />
            )}
          />
        </div>
        {results && (
          <div className="mt-2 flex flex-center mb-2">
            <Pagination
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
);

function MatcherFn(
  element: Element,
  match: [number, number],
  textContent: string
): string | void {
  const term = textContent.slice(match[0], match[1]);

  let start = match[0] - 100;

  start = start < 0 ? 0 : start;

  const content =
    (start > 0 ? textContent.substr(0, textContent.indexOf(' ')) + '...' : '') +
    textContent.slice(
      start,
      match[1] + (term.length > 300 ? term.length + 150 : 300)
    ) +
    '...';

  const matcher = regexpMatcher(term, content)[0];

  const node = document.createTextNode(content);
  element.appendChild(node);

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

const ContentItem = ({ item }: { item: SearchItem }) => {
  const parentRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (parentRef.current) {
      const matches = item.matches
        .map((m) => (m.start ? [m.start, m.end] : undefined))
        .filter(Boolean) as [number, number][];

      MatcherFn(parentRef.current, matches[0], item.item.textContent);
    }
  }, []);

  return <span ref={parentRef}></span>;
};

const searchSuggestions = (query: string, suggestions: Suggestions[]) =>
  suggestions
    .filter((sgg) => strNormalize(sgg.searchText).includes(strNormalize(query)))
    .map((sgg) => {
      return {
        value: sgg.searchText,
        label: (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>
              <Text type="secondary">{sgg.searchText}</Text>
            </span>
            <span>{sgg.found} resultat</span>
          </div>
        ),
      };
    });
