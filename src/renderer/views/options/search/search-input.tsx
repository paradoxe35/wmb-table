import { useCallback, useRef, useState } from 'react';
import { Input, AutoComplete, Select, Typography } from 'antd';
import { SelectProps } from 'antd/es/select';
import { debounce } from '@renderer/utils/functions';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';
import { useSearchStore } from '@renderer/stores';
import type { Suggestions, SearchMode } from '@shared/types';

const { Text } = Typography;

const SEARCH_MODE_OPTIONS: { value: SearchMode; label: string }[] = [
    { value: 'any', label: 'Au moins un mot' },
    { value: 'all', label: 'Tous les mots' },
    { value: 'exact', label: 'Phrase exacte' },
];

function buildSuggestionOptions(query: string, suggestions: Suggestions[]) {
    return suggestions
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
}

export default function SearchInput({
    onSearch,
    loading,
    suggestions,
}: {
    onSearch: (value: string) => void;
    loading: boolean;
    suggestions: React.RefObject<Suggestions[]>;
}) {
    const [options, setOptions] = useState<SelectProps<object>['options']>([]);
    const searchValue = useRef<string | null>(null);
    const searchMode = useSearchStore((s) => s.searchMode);
    const setSearchMode = useSearchStore((s) => s.setSearchMode);

    const handleSearchAutoComplete = (value: string) => {
        setOptions(value ? buildSuggestionOptions(value, suggestions.current) : []);
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
        <div className="search-input-container">
            <AutoComplete
                popupMatchSelectWidth={252}
                style={{ flex: 1 }}
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
            <Select
                size="large"
                value={searchMode}
                onChange={setSearchMode}
                options={SEARCH_MODE_OPTIONS}
                className="search-mode-select"
            />
        </div>
    );
}
