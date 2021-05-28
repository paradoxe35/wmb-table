import React, { useEffect, useRef, useState } from 'react';
import { Input, AutoComplete, Select, Typography } from 'antd';
import { SelectProps } from 'antd/es/select';
import { strNormalize } from '../../utils/functions';
import { Suggestions } from '../../types';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../../utils/ipc-events';

const { Option } = Select;

const { Text } = Typography;

//@ts-ignore
function Options() {
  function handleChange(value: string) {
    console.log(`selected ${value}`);
  }

  return (
    <div className="flex-center flex mt-2">
      <Select defaultValue="and" size="small" onChange={handleChange}>
        <Option value="and">Avec</Option>
        <Option value="or">Ou</Option>
        <Option value="not">Sans</Option>
      </Select>
    </div>
  );
}

type SearchFn = {
  onSearch: (value: string) => void;
  loading: boolean;
};

const useSearch = (): SearchFn => {
  const lastSearch = useRef<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const onSearch = (value: string) => {
    if (value.trim().length < 3 || lastSearch.current == value) {
      return;
    }
    lastSearch.current = value;
    setLoading(true);
    sendIpcRequest(IPC_EVENTS.search_text, value.trim())
      .then((datas) => {
        console.log(datas);
      })
      .finally(() => setLoading(false));
  };

  return { onSearch, loading };
};

export default function SearchOprion() {
  const suggestions = useRef<Suggestions[]>([]);
  const [options, setOptions] = useState<SelectProps<object>['options']>([]);
  const { loading, onSearch } = useSearch();

  const handleSearchAutoComplete = (value: string) => {
    setOptions(value ? searchResult(value, suggestions.current) : []);
  };

  useEffect(() => {
    sendIpcRequest<Suggestions[]>(IPC_EVENTS.search_suggestions).then(
      (suggests) => (suggestions.current = suggests)
    );
  }, []);

  return (
    <>
      <div className="flex-center flex">
        <AutoComplete
          dropdownMatchSelectWidth={252}
          style={{ width: 300 }}
          options={options}
          onSelect={onSearch}
          onSearch={handleSearchAutoComplete}
        >
          <Input.Search
            size="large"
            minLength={3}
            loading={loading}
            placeholder="Faites vos recherches ici"
            enterButton
            onPressEnter={(e) => onSearch(e.currentTarget.value)}
            onSearch={onSearch}
          />
        </AutoComplete>
      </div>
    </>
  );
}

const searchResult = (query: string, suggestions: Suggestions[]) =>
  suggestions
    .filter((sgg) => strNormalize(sgg.searchText).includes(strNormalize(query)))
    .map((sgg) => {
      return {
        value: sgg.searchText,
        label: (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>
              {query}, trouvé <Text type="secondary">{sgg.searchText}</Text>
            </span>
            <span>{sgg.found} resultat</span>
          </div>
        ),
      };
    });
