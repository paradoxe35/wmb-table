import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TantivySearchResult, Suggestions } from '@shared/types';
import { useAppStore, useSearchStore } from '@renderer/stores';
import SearchInput from './search-input';
import SearchResultList from './search-result-list';

function useSearch() {
    const { t } = useTranslation();
    const lastSearch = useRef('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<TantivySearchResult | null>(null);
    const hasNewResult = useRef(0);
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const searchMode = useSearchStore((s) => s.searchMode);
    const isFirstRender = useRef(true);
    const generationRef = useRef(0);

    const fetchResults = useCallback(
        (term: string, page: number) => {
            if (!activeLanguage || term.trim().length < 3) return;
            const gen = ++generationRef.current;
            setLoading(true);
            window.api.search
                .searchText(activeLanguage, term.trim(), page, searchMode)
                .then((datas) => {
                    if (gen !== generationRef.current) return;
                    hasNewResult.current += 1;
                    setResults(datas);
                })
                .catch(() => {
                    if (gen !== generationRef.current) return;
                    message.error(t('Erreur lors de la recherche'));
                })
                .finally(() => {
                    if (gen === generationRef.current) setLoading(false);
                });
        },
        [activeLanguage, searchMode],
    );

    const onSearch = useCallback(
        (value: string) => {
            if (value.trim().length < 3) {
                message.warning(t('Votre recherche doit comporter au moins trois caractères'));
                return;
            }
            if (lastSearch.current === value) return;
            lastSearch.current = value;
            fetchResults(value, 1);
        },
        [fetchResults],
    );

    // Re-search when mode changes (skip initial render)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (lastSearch.current.trim().length >= 3) {
            fetchResults(lastSearch.current, 1);
        }
    }, [searchMode]);

    const onPageChange = useCallback(
        (page: number) => {
            if (!activeLanguage) return;
            const gen = ++generationRef.current;
            window.api.search
                .searchText(activeLanguage, lastSearch.current.trim(), page, searchMode)
                .then((datas) => {
                    if (gen !== generationRef.current) return;
                    const lc = document.querySelector('.search__option__content');
                    lc?.scrollTo({ top: 0, behavior: 'smooth' });
                    setResults(datas);
                })
                .catch(() => {
                    if (gen !== generationRef.current) return;
                    message.error(t('Erreur lors de la recherche'));
                });
        },
        [activeLanguage, searchMode],
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
