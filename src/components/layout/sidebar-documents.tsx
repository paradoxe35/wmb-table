import React, { useEffect, useState } from 'react';
import { Input, Card, Layout, Tree, Divider } from 'antd';
import ContainerScrollY from '../container-scroll-y';
import { Title } from '../../types';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../../utils/ipc-events';
import DocumentViewer, { useDocumentViewOpen } from '../viewer/document-viewer';
import { strNormalize } from '../../utils/functions';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import {
  appDatasLoaded,
  documentTitles,
  sidebarStatusHidden,
  titlesDocumentByFileName,
  titlesGroupedByYear,
} from '../../store';
import PanelGroup from './components/documents-menu';
import { DataNode } from 'antd/lib/tree';

const { DirectoryTree } = Tree;

const { Search } = Input;

const { Sider } = Layout;

export default function SidebarDocuments() {
  const status = useRecoilValue(sidebarStatusHidden);
  return (
    <Sider
      hidden={status}
      width="263px"
      trigger={null}
      className="layout__sidebar"
      theme="light"
    >
      <PanelGroup
        tabs={[
          { name: 'Tous', active: true },
          { name: 'Années', active: false },
        ]}
      >
        {(index: number) => {
          return (
            <>
              <div hidden={index !== 0}>
                <DocumentSearch />
              </div>
              <div hidden={index !== 1}>
                <ContainerScrollY>
                  <DocumentByYears />
                </ContainerScrollY>
              </div>
            </>
          );
        }}
      </PanelGroup>
    </Sider>
  );
}

const DocumentByYears = () => {
  const documents = useRecoilValue(titlesGroupedByYear);
  const $titles = useRecoilValue(titlesDocumentByFileName);
  const viewDocument = useDocumentViewOpen();

  const dataTree = Object.keys(documents).map((year) => {
    const docs = documents[year]
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((doc) => {
        const title = $titles[doc.title].name;
        return {
          key: doc.title + year,
          title: (
            <span title={title} onClick={() => viewDocument(doc.title)}>
              {title}
            </span>
          ),
          className: 'document_grouped',
          isLeaf: true,
        };
      }) as DataNode[];
    return {
      title: (
        <span>
          {year} - ({docs.length})
        </span>
      ),
      key: year,
      children: docs,
    } as DataNode;
  });
  return (
    <>
      <div className="mt-2" />
      <DirectoryTree treeData={dataTree} />
    </>
  );
};

const DocumentSearch = () => {
  const [datas, setDatas] = useState<Title[]>([]);
  const [documents, setDocumentTitles] = useRecoilState(documentTitles);
  const setAppDataLoaded = useSetRecoilState(appDatasLoaded);

  const $titles = useRecoilValue(titlesDocumentByFileName);

  useEffect(() => {
    setDatas(documents);
  }, [documents]);

  useEffect(() => {
    sendIpcRequest<Title[]>(IPC_EVENTS.title_documents)
      .then((titles) => {
        setDocumentTitles(titles);
      })
      .finally(() => setAppDataLoaded(true));
  }, []);

  const onSearch = (value: string) => {
    if (documents.length) {
      setDatas(
        documents.filter((d) =>
          strNormalize(d.title).includes(strNormalize(value))
        )
      );
    }
  };

  return (
    <>
      <Card bordered={false}>
        <Search
          key={documents.length}
          placeholder="Recherche"
          allowClear
          onSearch={onSearch}
        />
      </Card>
      <Divider style={{ padding: '0', margin: '0' }} />
      <ContainerScrollY style={{ paddingLeft: '22px' }}>
        {datas
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((d) => (
            <ItemOutline
              key={d.title}
              id={d.title}
              name={d.title}
              title={$titles[d.title].name}
            />
          ))}
      </ContainerScrollY>
    </>
  );
};

const ItemOutline: React.FC<{ name: string; id: string; title: string }> = ({
  name,
  id,
  title,
}) => {
  return (
    <DocumentViewer name={name} id={id}>
      <span className="smart-editable" title={title}>
        <u>
          <span></span>
        </u>
        <b className="name">{title} </b>
      </span>
    </DocumentViewer>
  );
};
