import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { Input, AutoComplete, Typography, List, Pagination, message } from 'antd';
import { SelectProps } from 'antd/es/select';
import { debounce } from '@renderer/utils/functions';
import type { TantivySearchResult, TantivySearchHit, Suggestions } from '@shared/types';
import DocumentViewer from '@renderer/components/viewer/document-viewer';
import { useSearchStore, useAppStore, useSermonStore } from '@renderer/stores';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';
import { useSermonLookup } from '@renderer/hooks';

const { Text } = Typography;

const ITEMS_PER_PAGE = 20;

type SearchFn = {
    onSearch: (value: string) => void;
    loading: boolean;
    lastSearch: React.MutableRefObject<string>;
    results: TantivySearchResult | null;
    onPageChange: (page: number) => void;
    hasNewResult: React.MutableRefObject<number>;
};

type InputSearchType = {
    onSearch: (value: string) => void;
    loading: boolean;
    suggestions: React.MutableRefObject<Suggestions[]>;
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
            popupMatchSelectWidth={252}
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
    const [results, setResults] = useState<TantivySearchResult | null>(null);
    const hasNewResult = useRef(0);
    const activeLanguage = useAppStore((s) => s.activeLanguage);

    const onSearch = (value: string) => {
        if (!activeLanguage) return;
        if (value.trim().length < 3 || lastSearch.current === value) {
            if (value.trim().length < 3) {
                message.warning('Votre recherche doit comporter au moins trois caractères');
            }
            return;
        }
        lastSearch.current = value;
        setLoading(true);
        window.api.search
            .searchText(activeLanguage, value.trim(), 1)
            .then((datas) => {
                hasNewResult.current += 1;
                setResults(datas);
            })
            .finally(() => setLoading(false));
    };

    const onPageChange = useCallback(
        (page: number) => {
            if (!activeLanguage) return;
            window.api.search
                .searchText(activeLanguage, lastSearch.current.trim(), page)
                .then((datas) => {
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

    const activeLanguage = useAppStore((s) => s.activeLanguage);

    useEffect(() => {
        const can = lastSearch.current.trim().length > 0 && !!results && results.total > 0;

        if (can && activeLanguage) {
            window.api.search.addSuggestion(
                lastSearch.current.trim(),
                results!.total,
                activeLanguage,
            );
        }
        if (activeLanguage) {
            window.api.search.getSuggestions(activeLanguage).then((s) => (suggestions.current = s));
        }
    }, [hasNewResult.current, activeLanguage]);

    return (
        <>
            <div className="flex-center flex">
                <InputSearch onSearch={onSearch} loading={loading} suggestions={suggestions} />
            </div>
            <SearchResultComponent results={results} onPageChange={onPageChange} />
        </>
    );
}

const ListView = ({ hit, query }: { hit: TantivySearchHit; query: string }) => {
    const setDocumentViewQueries = useSearchStore((s) => s.setDocumentViewQueries);
    const setPendingNavigation = useSermonStore((s) => s.setPendingNavigation);
    const { getSermonById } = useSermonLookup();

    const handleDocumentClick = useCallback(() => {
        setDocumentViewQueries((docs) => {
            const datas = docs.filter((d) => d.documentTitle !== hit.title);
            return [
                ...datas,
                {
                    documentTitle: hit.title,
                    textContentLength: 0,
                    matches: [],
                    term: query,
                },
            ];
        });
        if (hit.paragraphIndex > 0) {
            setPendingNavigation({
                documentTitle: hit.title,
                documentHtmlTree: {
                    paragraphIndex: hit.paragraphIndex,
                    translationId: hit.translationId,
                    languageCode: '',
                },
            });
        }
    }, [hit, setDocumentViewQueries, setPendingNavigation, query]);

    const displayTitle = getSermonById(hit.sermonId)?.title ?? hit.title;

    return (
        <List.Item>
            <List.Item.Meta
                title={
                    <a className="underline">
                        <DocumentViewer
                            onItemClick={handleDocumentClick}
                            name={hit.title}
                            sermonId={hit.sermonId}
                        >
                            {displayTitle}
                        </DocumentViewer>
                    </a>
                }
                description={
                    <>
                        <span
                            className="content-description-2"
                            dangerouslySetInnerHTML={{ __html: hit.snippet }}
                        />
                        {hit.hitCount > 0 && (
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {hit.hitCount} correspondance{hit.hitCount > 1 ? 's' : ''}
                                </Text>
                            </div>
                        )}
                    </>
                }
            />
        </List.Item>
    );
};

const SearchResultComponent = memo(function SearchResultComponent({
    results,
    onPageChange,
}: {
    results: TantivySearchResult | null;
    onPageChange?: (page: number) => void;
}) {
    const totalPages = results ? Math.ceil(results.total / ITEMS_PER_PAGE) : 0;
    const [currentPage, setCurrentPage] = useState(1);

    const handlePageChange = useCallback(
        (page: number) => {
            setCurrentPage(page);
            onPageChange?.(page);
        },
        [onPageChange],
    );

    // Reset to page 1 when query changes
    useEffect(() => {
        setCurrentPage(1);
    }, [results?.query]);

    return (
        <>
            {results && (
                <div className="mt-2 flex flex-center">
                    <Text type="secondary">
                        Trouvé dans {results.total} document{results.total > 1 ? 's' : ''}
                        {totalPages > 1 ? `, page (${currentPage}/${totalPages})` : ''}
                    </Text>
                </div>
            )}
            <List
                className="mt-2"
                itemLayout="vertical"
                dataSource={results?.hits || []}
                renderItem={(hit) => (
                    <ListView
                        key={`${hit.title}-${results?.query}`}
                        hit={hit}
                        query={results?.query ?? ''}
                    />
                )}
            />
            {results && totalPages > 1 && (
                <div className="mt-2 flex flex-center mb-2">
                    <Pagination
                        key={results.query}
                        onChange={handlePageChange}
                        defaultCurrent={1}
                        showSizeChanger={false}
                        pageSize={ITEMS_PER_PAGE}
                        total={results.total}
                    />
                </div>
            )}
        </>
    );
});

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
