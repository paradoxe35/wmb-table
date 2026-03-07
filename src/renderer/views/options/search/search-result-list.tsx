import { useCallback, useEffect, useState, memo } from 'react';
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
                            ? `Trouvé dans ${results.hits.length} document${results.hits.length > 1 ? 's' : ''}${totalPages > 1 ? `, page (${currentPage}/${totalPages})` : ''}`
                            : 'Aucun résultat trouvé'}
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
