import { useCallback, useEffect, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, List, Pagination } from 'antd';
import type { TantivySearchResult } from '@shared/types';
import { useSearchStore } from '@renderer/stores';
import SearchResultItem from './search-result-item';

const { Text } = Typography;

const ITEMS_PER_PAGE = 20;

export default memo(function SearchResultList({
    results,
    onPageChange,
}: {
    results: TantivySearchResult | null;
    onPageChange?: (page: number) => void;
}) {
    const { t } = useTranslation();
    const searchMode = useSearchStore((s) => s.searchMode);
    const [currentPage, setCurrentPage] = useState(1);
    const exactTotalPages = results ? Math.ceil(results.total / ITEMS_PER_PAGE) : 0;
    const canShowSyntheticNextPage =
        !!results && !results.totalIsExact && results.hits.length === ITEMS_PER_PAGE;
    const totalPages = results
        ? results.totalIsExact
            ? exactTotalPages
            : Math.max(exactTotalPages, currentPage + (canShowSyntheticNextPage ? 1 : 0))
        : 0;
    const paginationTotal = results
        ? results.totalIsExact
            ? results.total
            : Math.max(
                  results.total,
                  (currentPage + (canShowSyntheticNextPage ? 1 : 0)) * ITEMS_PER_PAGE,
              )
        : 0;
    const hasResults = !!results && results.hits.length > 0;
    const resultsLabel = hasResults
        ? t(
              results.totalIsExact
                  ? results.total > 1
                      ? 'Trouvé dans {{count}} documents'
                      : 'Trouvé dans {{count}} document'
                  : 'Trouvé dans au moins {{count}} documents',
              { count: results.total },
          )
        : t('Aucun résultat trouvé');

    const pageLabel =
        hasResults && totalPages > 1
            ? t('page ({{current}}/{{total}})', { current: currentPage, total: totalPages })
            : '';

    const resultsSummary = pageLabel ? `${resultsLabel}, ${pageLabel}` : resultsLabel;

    const handlePageChange = useCallback(
        (page: number) => {
            setCurrentPage(page);
            onPageChange?.(page);
        },
        [onPageChange],
    );

    // Reset to page 1 when query or mode changes
    useEffect(() => {
        setCurrentPage(1);
    }, [results?.query, searchMode]);

    return (
        <>
            {results && (
                <div className="mt-2 flex flex-center">
                    <Text type="secondary">{resultsSummary}</Text>
                </div>
            )}
            <List
                className="mt-2"
                itemLayout="vertical"
                dataSource={results?.hits || []}
                renderItem={(hit) => (
                    <SearchResultItem
                        key={`${hit.title}-${results?.query}`}
                        hit={hit}
                        query={results?.query ?? ''}
                    />
                )}
            />
            {results && totalPages > 1 && (
                <div className="mt-2 flex flex-center" style={{ paddingBottom: 20 }}>
                    <Pagination
                        key={`${results.query}::${searchMode}`}
                        onChange={handlePageChange}
                        defaultCurrent={1}
                        showSizeChanger={false}
                        pageSize={ITEMS_PER_PAGE}
                        total={paginationTotal}
                    />
                </div>
            )}
        </>
    );
});
