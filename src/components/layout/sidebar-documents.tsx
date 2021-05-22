import React from 'react';
import { Layout } from 'antd';
import { Input, Space, Card } from 'antd';
import ContainerScrollY from '../container-scroll-y';

const { Search } = Input;

const { Sider } = Layout;

const data = new Array(110).fill({
  title: 'Ant Design Title 1',
});

export default function SidebarDocuments() {
  const onSearch = (value: string) => console.log(value);

  return (
    <Sider
      width="263px"
      trigger={null}
      className="layout__sidebar"
      theme="light"
    >
      <Space direction="vertical">
        <Card>
          <Search placeholder="Recherche" allowClear onSearch={onSearch} />
        </Card>
      </Space>
      <ContainerScrollY style={{ paddingLeft: '22px' }}>
        {data.map((d, i) => (
          <ItemOutline key={i} name={d.title} />
        ))}
      </ContainerScrollY>
    </Sider>
  );
}

const ItemOutline: React.FC<{ name: string }> = ({ name }) => {
  return (
    <span className="smart-editable">
      <u>
        <span></span>
      </u>
      <b className="name">{name} </b>
    </span>
  );
};
