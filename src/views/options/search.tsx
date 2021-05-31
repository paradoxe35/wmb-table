import React, { useEffect, useRef, useState } from 'react';
import {
  Input,
  AutoComplete,
  Select,
  Typography,
  List,
  Divider,
  Pagination,
} from 'antd';
import { SelectProps } from 'antd/es/select';
import { strNormalize } from '../../utils/functions';
import {
  FuseSearchMatchersValue,
  FuseSearchResult,
  Suggestions,
} from '../../types';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../../utils/ipc-events';

const { Option } = Select;

const { Text } = Typography;

//@ts-ignore
function Options() {
  function handleChange(value: string) {
    console.log(`selected ${value}`);
  }

  return (
    <div className="flex-center flex mt-2">
      <Select defaultValue="and" size="small" onChange={handleChange}>
        <Option value="and">Avec</Option>
        <Option value="or">Ou</Option>
        <Option value="not">Sans</Option>
      </Select>
    </div>
  );
}

type SearchFn = {
  onSearch: (value: string) => void;
  loading: boolean;
  results: FuseSearchResult | null;
};

const useSearch = (): SearchFn => {
  const lastSearch = useRef<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<FuseSearchResult | null>(null);

  const onSearch = (value: string) => {
    if (value.trim().length < 3 || lastSearch.current == value) {
      return;
    }
    lastSearch.current = value;
    setLoading(true);
    sendIpcRequest<FuseSearchResult>(IPC_EVENTS.search_text, value.trim())
      .then((datas) => setResults(datas))
      .finally(() => setLoading(false));
  };

  return { onSearch, loading, results };
};

export default function Search() {
  const suggestions = useRef<Suggestions[]>([]);
  const [options, setOptions] = useState<SelectProps<object>['options']>([]);
  const { loading, onSearch, results } = useSearch();

  const handleSearchAutoComplete = (value: string) => {
    setOptions(value ? searchSuggestions(value, suggestions.current) : []);
  };

  console.log(results);

  useEffect(() => {
    sendIpcRequest<Suggestions[]>(IPC_EVENTS.search_suggestions).then(
      (suggests) => (suggestions.current = suggests)
    );
  }, []);

  return (
    <>
      <div className="flex-center flex">
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
      </div>

      <SearchResult results={results} />
    </>
  );
}

const SearchResult = React.memo(
  ({ results }: { results: FuseSearchResult | null }) => {
    console.log(results);

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
            dataSource={
              results?.data && results?.data.length ? [results?.data[0]] : []
            }
            renderItem={(result) => (
              <>
                <List.Item key={result.item.title}>
                  <List.Item.Meta
                    title={<a>{result.item.title}</a>}
                    description={
                      <span>
                        {result.matches[0].indices.length} correspondances
                        trouvées.
                      </span>
                    }
                  />
                  <ContentItem matcher={result.matches[0]} />
                </List.Item>
                <Divider />
              </>
            )}
          />
        </div>
        {results && (
          <div className="mt-2 flex flex-center mb-2">
            <Pagination
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

//@ts-ignore
function MatcherFn(element: Element, matchesArr: [number, number][]) {
  let nodeFilter = {
    acceptNode: function (node: any) {
      if (/^[\t\n\r ]*$/.test(node.nodeValue)) {
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  };

  let index = 0;
  let matches = matchesArr
    .sort(function (a, b) {
      return a[0] - b[0];
    })
    .slice();
  let previousMatch = [-1, -1];
  let match = matches.shift();
  let walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    nodeFilter,
    false
  );

  let node: Node | null;

  while ((node = walker.nextNode())) {
    if (match == undefined) break;
    if (match[0] == previousMatch[0]) continue;

    // let text = node.textContent;
    //@ts-ignore
    let nodeEndIndex = index + node.length;

    if (match[0] < nodeEndIndex) {
      var range = document.createRange(),
        tag = document.createElement('mark'),
        rangeStart = match[0] - index,
        rangeEnd = rangeStart + match[1];

      tag.dataset.rangeStart = rangeStart.toString();
      tag.dataset.rangeEnd = rangeEnd.toString();

      range.setStart(node, rangeStart);
      range.setEnd(node, rangeEnd);
      range.surroundContents(tag);

      index = match[0] + match[1];

      // the next node will now actually be the text we just wrapped, so
      // we need to skip it
      walker.nextNode();
      previousMatch = match;
      match = matches.shift();
    } else {
      index = nodeEndIndex;
    }
  }
}

const ContentItem = ({ matcher }: { matcher: FuseSearchMatchersValue }) => {
  const parentRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.hidden = true;

      const node = document.createTextNode(matcher.value);
      parentRef.current.appendChild(node);

      // const l = matcher.indices[matcher.indices.length - 1];
      console.log(matcher);

      matcher.indices.forEach((l) => {
        console.log(matcher.value.slice(l[0], l[1] + 1));
      });

      // MatcherFn(parentRef.current, [matcher.indices[0]]);

      // matcher.indices.forEach((mtch) => {
      //   if (!matcher.value[mtch[0]] || !matcher.value[mtch[1]]) {
      //     return;
      //   }
      //   const range = document.createRange();
      //   const tag = document.createElement('mark');

      //   tag.dataset.rangeStart = mtch[0].toString();
      //   tag.dataset.rangeEnd = mtch[1].toString();

      //   range.setStart(node, mtch[0]);
      //   range.setEnd(node, mtch[1]);

      //   range.surroundContents(tag);
      // });
    }
  }, [matcher]);

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
              {query}, trouvé <Text type="secondary">{sgg.searchText}</Text>
            </span>
            <span>{sgg.found} resultat</span>
          </div>
        ),
      };
    });
