import React from 'react';
import DocumentTabs from '../components/document-tabs';
import { Layout } from 'antd';
import { currentDocumentTabs } from '../store';
import { useRecoilValue } from 'recoil';

const { Content } = Layout;

export default function DocumentView() {
  const title = useRecoilValue(currentDocumentTabs);

  return (
    <>
      <DocumentTabs />
      <Content className="mock-browser-content">{title}</Content>
    </>
  );
}
