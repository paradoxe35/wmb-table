import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import type { TantivySearchResult, Suggestions } from '@shared/types';
import { useAppStore } from '@renderer/stores';
import SearchInput from './search-input';
import SearchResultList from './search-result-list';

const ITEMS_PER_PAGE = 20;

function useSearch() {
    const lastSearch = useRef('');
    const [loading, setLoading] = useState(false);
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
}

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
                <SearchInput onSearch={onSearch} loading={loading} suggestions={suggestions} />
            </div>
            <SearchResultList results={results} onPageChange={onPageChange} />
        </>
    );
}
