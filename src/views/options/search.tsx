import React, { useState } from 'react';
import { Input, AutoComplete, Select } from 'antd';
import { SelectProps } from 'antd/es/select';

const { Option } = Select;

export default function SearchOprion() {
  const [options, setOptions] = useState<SelectProps<object>['options']>([]);

  const handleSearch = (value: string) => {
    setOptions(value ? searchResult(value) : []);
  };

  const onSelect = (value: string) => {
    console.log('onSelect', value);
  };

  function handleChange(value: string) {
    console.log(`selected ${value}`);
  }

  return (
    <>
      <div className="flex-center flex">
        <AutoComplete
          dropdownMatchSelectWidth={252}
          style={{ width: 300 }}
          options={options}
          onSelect={onSelect}
          onSearch={handleSearch}
        >
          <Input.Search
            size="large"
            placeholder="Faites vos recherches ici"
            enterButton
          />
        </AutoComplete>
      </div>
      <div className="flex-center flex mt-2">
        <Select defaultValue="and" size="small" onChange={handleChange}>
          <Option value="and">Avec</Option>
          <Option value="or">Ou</Option>
          <Option value="not">Sans</Option>
        </Select>
      </div>
    </>
  );
}

function getRandomInt(max: number, min: number = 0) {
  return Math.floor(Math.random() * (max - min + 1)) + min; // eslint-disable-line no-mixed-operators
}

const searchResult = (query: string) =>
  new Array(getRandomInt(5))
    .join('.')
    .split('.')
    .map((_, idx) => {
      const category = `${query}${idx}`;
      return {
        value: category,
        label: (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>
              Found {query} on{' '}
              <a
                href={`https://s.taobao.com/search?q=${query}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {category}
              </a>
            </span>
            <span>{getRandomInt(200, 100)} results</span>
          </div>
        ),
      };
    });
