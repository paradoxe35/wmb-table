import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Divider, Input, Pagination, Select, Space, Typography } from 'antd';
import type { BibleSearchResult } from '@shared/types';
import HighlightedText from '@renderer/components/highlighted-text';
import { debounce } from '@renderer/utils/functions';

const TESTAMENTS = [
    { name: 'Nouveau Testament', value: 'N' },
    { name: 'Ancien Testament', value: 'O' },
];

type Testament = (typeof TESTAMENTS)[0];

// ---------------------------------------------------------------------------
// Bible search (root)
// ---------------------------------------------------------------------------

export function SearchContent() {
    const [results, setResults] = useState<BibleSearchResult | null>(null);
    const lastSearch = useRef<string>('');
    const testament = useRef<Testament | undefined>(undefined);

    const onPageChange = useCallback((page: number) => {
        window.api.bible
            .search(lastSearch.current.trim(), page, testament.current?.value)
            .then((datas) => {
                document
                    .querySelector('.bible__option__content')
                    ?.scrollTo({ top: 0, behavior: 'smooth' });
                setResults(datas);
            });
    }, []);

    return (
        <>
            <div className="flex flex-center">
                <InputSearchBible
                    testament={testament}
                    setResults={setResults}
                    lastSearch={lastSearch}
                />
            </div>
            <SearchResult onPageChange={onPageChange} results={results} />
        </>
    );
}

// ---------------------------------------------------------------------------
// Search input
// ---------------------------------------------------------------------------

function InputSearchBible({
    setResults,
    lastSearch,
    testament,
}: {
    setResults: React.Dispatch<React.SetStateAction<BibleSearchResult | null>>;
    lastSearch: React.RefObject<string>;
    testament: React.RefObject<Testament | undefined>;
}) {
    const { t: tr } = useTranslation();
    const [loading, setLoading] = useState(false);

    const handleSearch = useCallback(
        (value: string) => {
            if (!value || value.length < 3) return;
            lastSearch.current = value;
            setLoading(true);
            window.api.bible
                .search(value, 1, testament.current?.value)
                .then(setResults)
                .finally(() => setLoading(false));
        },
        [lastSearch, setResults],
    );

    const onTestamentChange = useCallback(
        (value: string | undefined) => {
            testament.current = TESTAMENTS.find((t) => t.value === value);
        },
        [testament],
    );

    const testamentOptions = useMemo(
        () => TESTAMENTS.map((t) => ({ value: t.value, label: tr(t.name) })),
        [tr],
    );

    return (
        <Space>
            <Input.Search
                style={{ width: 300 }}
                size="large"
                minLength={3}
                allowClear
                loading={loading}
                placeholder={tr('Faites vos recherches biblique ici')}
                enterButton
                onSearch={debounce(handleSearch, 100)}
            />
            <Select
                style={{ minWidth: 170 }}
                size="large"
                placeholder={tr('Testaments')}
                className="w-100 max-w-100"
                onChange={onTestamentChange}
                allowClear
                options={testamentOptions}
            />
        </Space>
    );
}

// ---------------------------------------------------------------------------
// Search results
// ---------------------------------------------------------------------------

const SearchResult = memo(function SearchResult({
    results,
    onPageChange,
}: {
    results: BibleSearchResult | null;
    onPageChange?: (page: number) => void;
}) {
    const { t } = useTranslation();
    return (
        <>
            {results && (
                <div className="mt-2 flex flex-center">
                    <Typography.Text type="secondary">
                        {t(
                            results.total > 1
                                ? 'Trouvé dans {{count}} versets'
                                : 'Trouvé dans {{count}} verset',
                            { count: results.total },
                        )}
                        ,{' '}
                        {t('page ({{current}}/{{total}})', {
                            current: results.pageNumber,
                            total: Math.ceil(results.total / results.itemsPerPage),
                        })}
                    </Typography.Text>
                </div>
            )}
            <div className="mt-2" style={{ width: '100%' }}>
                {(results?.data || []).map((result) => (
                    <div key={result.item.id} style={{ padding: '8px 0' }}>
                        <div style={{ fontWeight: 500 }}>
                            {result.item.bookName} {result.item.chapter}:{result.item.verse}
                        </div>
                        <span className="content-description-2">
                            <HighlightedText
                                text={result.item.content}
                                query={results?.query ?? ''}
                                mode="all"
                            />
                        </span>
                        <Divider style={{ margin: '8px 0' }} />
                    </div>
                ))}
            </div>
            {results && (
                <div className="mt-2 flex flex-center mb-2">
                    <Pagination
                        key={results.query}
                        onChange={onPageChange}
                        defaultCurrent={results.pageNumber}
                        showSizeChanger={false}
                        pageSize={results.itemsPerPage}
                        total={results.total}
                    />
                </div>
            )}
        </>
    );
});
