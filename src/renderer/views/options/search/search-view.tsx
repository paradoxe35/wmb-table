import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TantivySearchResult, Suggestions } from '@shared/types';
import { useAppStore, useSearchStore } from '@renderer/stores';
import SearchInput from './search-input';
import SearchResultList from './search-result-list';
import { getSearchPageHelp } from '../components/option-help-content';
import OptionPageLayout from '../components/option-page-layout';

function useSearch() {
    const { t } = useTranslation();
    const lastSearch = useRef('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<TantivySearchResult | null>(null);
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const searchMode = useSearchStore((s) => s.searchMode);
    const isFirstRender = useRef(true);
    const generationRef = useRef(0);

    const fetchResults = useCallback(
        (term: string, page: number) => {
            if (!contentLanguage || term.trim().length < 3) return;
            const gen = ++generationRef.current;
            setLoading(true);
            window.api.search
                .searchText(contentLanguage, term.trim(), page, searchMode)
                .then((datas) => {
                    if (gen !== generationRef.current) return;
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
        [contentLanguage, searchMode, t],
    );

    const onSearch = useCallback(
        (value: string) => {
            if (value.trim().length < 3) {
                message.warning(t('Votre recherche doit comporter au moins trois caractères'));
                return;
            }
            lastSearch.current = value;
            fetchResults(value, 1);
        },
        [fetchResults, t],
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
    }, [fetchResults, searchMode]);

    const onPageChange = useCallback(
        (page: number) => {
            if (!contentLanguage) return;
            const gen = ++generationRef.current;
            window.api.search
                .searchText(contentLanguage, lastSearch.current.trim(), page, searchMode)
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
        [contentLanguage, searchMode, t],
    );

    return { onSearch, loading, results, onPageChange, lastSearch };
}

export default function Search() {
    const { t } = useTranslation();
    const suggestions = useRef<Suggestions[]>([]);
    const { loading, onSearch, results, lastSearch, onPageChange } = useSearch();
    const contentLanguage = useAppStore((s) => s.contentLanguage);

    useEffect(() => {
        const query = results?.query?.trim() ?? lastSearch.current.trim();
        const can = query.length > 0 && !!results && results.total > 0 && results.totalIsExact;

        if (can && contentLanguage) {
            window.api.search.addSuggestion(query, results.total, contentLanguage);
        }
        if (contentLanguage) {
            window.api.search
                .getSuggestions(contentLanguage)
                .then((s) => (suggestions.current = s));
        }
    }, [contentLanguage, lastSearch, results]);

    return (
        <OptionPageLayout title={t('Recherche')} help={getSearchPageHelp(t)}>
            <div className="option-page-search-row">
                <SearchInput onSearch={onSearch} loading={loading} suggestions={suggestions} />
            </div>
            <SearchResultList results={results} onPageChange={onPageChange} />
        </OptionPageLayout>
    );
}
