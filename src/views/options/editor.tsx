import React, { useState } from 'react';
import { EditFilled, AppstoreOutlined } from '@ant-design/icons';
import { Menu } from 'antd';

export default function Editor() {
  const [tab, setTab] = useState<string>('editor');

  const handleClick = (e: { key: string | number }) => {
    setTab(e.key as string);
  };
  return (
    <>
      <Menu onClick={handleClick} selectedKeys={[tab]} mode="horizontal">
        <Menu.Item key="editor" icon={<EditFilled />}>
          Editeur
        </Menu.Item>
        <Menu.Item key="documents" icon={<AppstoreOutlined />}>
          Documents
        </Menu.Item>
      </Menu>
      <div className="mt-2 mb-2" />
      <div hidden={tab !== 'editor'}>
        <EditorContent />
      </div>
      <div hidden={tab !== 'documents'}>
        <Documents />
      </div>
    </>
  );
}

function EditorContent() {
  return <>editor</>;
}

function Documents() {
  return <>documents</>;
}
