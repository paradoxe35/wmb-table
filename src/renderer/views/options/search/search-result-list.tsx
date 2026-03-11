import { useCallback, useEffect, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, List, Pagination } from 'antd';
import type { TantivySearchResult } from '@shared/types';
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
    const totalPages = results ? Math.ceil(results.total / ITEMS_PER_PAGE) : 0;
    const [currentPage, setCurrentPage] = useState(1);

    const handlePageChange = useCallback(
        (page: number) => {
            setCurrentPage(page);
            onPageChange?.(page);
        },
        [onPageChange],
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [results?.query]);

    return (
        <>
            {results && (
                <div className="mt-2 flex flex-center">
                    <Text type="secondary">
                        {results.hits.length > 0
                            ? `${t(results.hits.length > 1 ? 'Trouvé dans {{count}} documents' : 'Trouvé dans {{count}} document', { count: results.hits.length })}${totalPages > 1 ? `, ${t('page ({{current}}/{{total}})', { current: currentPage, total: totalPages })}` : ''}`
                            : t('Aucun résultat trouvé')}
                    </Text>
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
