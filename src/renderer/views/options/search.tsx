import { useCallback, useEffect, useRef, useState, memo, type MutableRefObject } from 'react';
import { Input, AutoComplete, Typography, List, Divider, Pagination, message } from 'antd';
import { SelectProps } from 'antd/es/select';
import { debounce, trimBeforeDotAndComma } from '@renderer/utils/functions';
import type { SearchItem, SearchResult, Suggestions } from '@shared/types';
import DocumentViewer from '@renderer/components/viewer/document-viewer';
import { useSearchStore, useAppStore } from '@renderer/stores';
import {
    escapeRegExp,
    regexpMatcher,
    simpleRegExp,
    strNormalize,
    surroundContentsTag,
} from '@renderer/utils/searchable';
import { useSermonLookup } from '@renderer/hooks';

const { Text } = Typography;

type SearchFn = {
    onSearch: (value: string) => void;
    loading: boolean;
    lastSearch: MutableRefObject<string>;
    results: SearchResult | null;
    onPageChange: (page: number) => void;
    hasNewResult: MutableRefObject<number>;
};

type InputSearchType = {
    onSearch: (value: string) => void;
    loading: boolean;
    suggestions: MutableRefObject<Suggestions[]>;
};

function InputSearch({ onSearch, loading, suggestions }: InputSearchType) {
    const [options, setOptions] = useState<SelectProps<object>['options']>([]);
    const searchValue = useRef<string | null>(null);

    const handleSearchAutoComplete = (value: string) => {
        setOptions(value ? searchSuggestions(value, suggestions.current) : []);
    };

    const onSelect = useCallback((value: string) => {
        searchValue.current = value;
    }, []);

    const handleSearch = useCallback(
        (value: string) => {
            if (searchValue.current || value) {
                onSearch(searchValue.current || value);
                searchValue.current = null;
            }
        },
        [onSearch],
    );

    return (
        <AutoComplete
            dropdownMatchSelectWidth={252}
            style={{ width: 300 }}
            options={options}
            onSelect={onSelect}
            onSearch={handleSearchAutoComplete}
        >
            <Input.Search
                size="large"
                minLength={3}
                allowClear
                loading={loading}
                placeholder="Faites vos recherches ici"
                enterButton
                onSearch={debounce(handleSearch, 100)}
            />
        </AutoComplete>
    );
}

const useSearch = (): SearchFn => {
    const lastSearch = useRef<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [results, setResults] = useState<SearchResult | null>(null);
    const hasNewResult = useRef(0);
    const activeLanguage = useAppStore((s) => s.activeLanguage);

    const onSearch = (value: string) => {
        if (value.trim().length < 3 || lastSearch.current === value) {
            if (value.trim().length < 3) {
                message.warning('Votre recherche doit comporter au moins trois caractères');
            }
            return;
        }
        lastSearch.current = value;
        setLoading(true);
        (window.api.search.searchText(activeLanguage, value.trim(), 1) as Promise<SearchResult>)
            .then((datas) => {
                hasNewResult.current += 1;
                setResults(datas);
            })
            .finally(() => setLoading(false));
    };

    const onPageChange = useCallback(
        (page: number) => {
            (
                window.api.search.searchText(
                    activeLanguage,
                    lastSearch.current.trim(),
                    page,
                ) as Promise<SearchResult>
            ).then((datas) => {
                const lc = document.querySelector('.search__option__content');
                lc?.scrollTo({ top: 0, behavior: 'smooth' });
                setResults(datas);
            });
        },
        [activeLanguage],
    );

    return { onSearch, loading, results, onPageChange, lastSearch, hasNewResult };
};

export default function Search() {
    const suggestions = useRef<Suggestions[]>([]);

    const { loading, onSearch, results, lastSearch, hasNewResult, onPageChange } = useSearch();

    useEffect(() => {
        const can = lastSearch.current.trim().length > 0 && !!results && results.total > 0;

        if (can) {
            window.api.search.addSuggestion(lastSearch.current.trim(), results!.total);
        }
        (window.api.search.getSuggestions() as Promise<Suggestions[]>).then(
            (s) => (suggestions.current = s),
        );
    }, [hasNewResult.current]);

    return (
        <>
            <div className="flex-center flex">
                <InputSearch onSearch={onSearch} loading={loading} suggestions={suggestions} />
            </div>
            <SearchResultComponent results={results} onPageChange={onPageChange} />
        </>
    );
}

const ListView = ({ result, query }: { result: SearchItem; query: string }) => {
    const setDocumentViewQueries = useSearchStore((s) => s.setDocumentViewQueries);
    const { getSermon } = useSermonLookup();

    const handleDocumentClick = useCallback(() => {
        setDocumentViewQueries((docs) => {
            const datas = docs.filter((d) => d.documentTitle !== result.item.title);
            return [
                ...datas,
                {
                    documentTitle: result.item.title,
                    textContentLength: result.item.textContent.length,
                    matches: result.matches,
                    term: query,
                },
            ];
        });
    }, [result, setDocumentViewQueries, query]);

    const displayTitle = getSermon(result.item.title)?.title ?? result.item.title;

    return (
        <>
            <List.Item key={`${result.item.title}-${query}`}>
                <List.Item.Meta
                    title={
                        <Text underline>
                            <a>
                                <DocumentViewer
                                    onItemClick={handleDocumentClick}
                                    name={result.item.title}
                                    id={result.item.id}
                                >
                                    {displayTitle}
                                </DocumentViewer>
                            </a>
                        </Text>
                    }
                    description={
                        <span>
                            {result.matches.length} correspondance
                            {result.matches.length > 1 ? 's' : ''} trouvée
                            {result.matches.length > 1 ? 's' : ''}.
                        </span>
                    }
                />
                <ContentItem key={`${result.item.title}-${query}`} item={result} />
            </List.Item>
            <Divider />
        </>
    );
};

const SearchResultComponent = memo(function SearchResultComponent({
    results,
    onPageChange,
}: {
    results: SearchResult | null;
    onPageChange?: (page: number) => void;
}) {
    return (
        <>
            {results && (
                <div className="mt-2 flex flex-center">
                    <Text type="secondary">
                        Trouvé dans {results.total} document
                        {results.total > 1 ? 's' : ''}, page({results.pageNumber}/
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
                        <ListView result={result} query={results?.query ?? ''} />
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
});

function MatcherFn(element: Element, match: [number, number], textContent: string): void {
    const term = textContent.slice(match[0], match[1]);

    let start = match[0] - 100;
    start = start < 0 ? 0 : start;

    let content =
        (start > 0 ? textContent.substring(0, textContent.indexOf(' ')) + '...' : '') +
        textContent.slice(start, match[1] + (term.length > 300 ? term.length + 150 : 300)) +
        '...';

    content = trimBeforeDotAndComma(content.replace(/[\n]/g, ' '), [',', '.']);

    const matcher = regexpMatcher(escapeRegExp(term), content)[0];

    const node = document.createTextNode(content);
    element.appendChild(node);

    if (matcher && matcher.start != null && matcher.end != null) {
        surroundContentsTag(node, undefined, matcher.start, matcher.end);
    }
}

const ContentItem = ({ item }: { item: SearchItem }) => {
    const parentRef = useRef<HTMLSpanElement | null>(null);

    useEffect(() => {
        if (parentRef.current) {
            const matches = item.matches
                .map((m) => (m.start != null ? [m.start, m.end] : undefined))
                .filter(Boolean) as [number, number][];

            if (matches[0]) {
                MatcherFn(parentRef.current, matches[0], item.item.textContent);
            }
        }
    }, [item]);

    return <span className="content-description-2" ref={parentRef}></span>;
};

const searchSuggestions = (query: string, suggestions: Suggestions[]) =>
    suggestions
        .filter((sgg) => simpleRegExp(query).test(strNormalize(sgg.searchText)))
        .map((sgg) => ({
            value: sgg.searchText,
            label: (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                        <Text type="secondary">{sgg.searchText}</Text>
                    </span>
                    <span>{sgg.found} resultat</span>
                </div>
            ),
        }));
