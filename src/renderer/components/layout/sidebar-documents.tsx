import React, { useEffect, useState } from 'react';
import { Input, Card, Layout, Tree, Divider } from 'antd';
import ContainerScrollY from '../container-scroll-y';
import { Title } from '@localtypes/index';
import sendIpcRequest from '@root/ipc/ipc-renderer';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import DocumentViewer, { useDocumentViewOpen } from '../viewer/document-viewer';
import { strNormalize } from '@root/utils/functions';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import {
  appDatasLoadedStore,
  customDocumentsStore,
  documentTitlesStore,
  sidebarStatusHiddenStore,
  titlesGroupedByYearSelector,
  titlesStore,
} from '@renderer/store';
import PanelGroup from './components/documents-menu';
import { DataNode } from 'antd/lib/tree';
import DocumentTitle from '@renderer/store/models/document_title';

const { DirectoryTree } = Tree;

const { Search } = Input;

const { Sider } = Layout;

export default function SidebarDocuments() {
  const status = useRecoilValue(sidebarStatusHiddenStore);
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
          { name: 'Ajoutés', active: false },
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
                  <div className="mt-2" />
                  <DocumentByYears />
                </ContainerScrollY>
              </div>
              <div hidden={index !== 2}>
                <div className="mt-2" />
                <DocumentsAdded />
              </div>
            </>
          );
        }}
      </PanelGroup>
    </Sider>
  );
}

const DocumentsAdded = () => {
  const customDocuments = useRecoilValue(customDocumentsStore);
  return (
    <ContainerScrollY style={{ paddingLeft: '10px' }}>
      {customDocuments.map((d, i) => (
        <ItemOutline
          key={d._id || i}
          id={d._id}
          name={d.title}
          title={d.title}
        />
      ))}
    </ContainerScrollY>
  );
};

const DocumentByYears = () => {
  const documents = useRecoilValue(titlesGroupedByYearSelector);
  const viewDocument = useDocumentViewOpen();

  const dataTree = Object.keys(documents).map((year) => {
    const docs = documents[year]
      .slice()
      .sort((a, b) => a.getTitle().localeCompare(b.getTitle()))
      .map((doc) => {
        const title = doc.getTitle();
        return {
          key: title + year,
          title: (
            <span
              key={doc.getId()}
              title={title}
              onClick={() => viewDocument(title)}
            >
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
      <DirectoryTree treeData={dataTree} />
    </>
  );
};

const DocumentSearch = () => {
  const [datas, setDatas] = useState<DocumentTitle[]>([]);

  const documents = useRecoilValue(documentTitlesStore);
  const setDocuments = useSetRecoilState(titlesStore);

  const setAppDataLoaded = useSetRecoilState(appDatasLoadedStore);

  useEffect(() => {
    setDatas(documents);
  }, [documents]);

  useEffect(() => {
    sendIpcRequest<Title[]>(IPC_EVENTS.title_documents)
      .then((titles) => {
        setDocuments(titles);
      })
      .finally(() => setAppDataLoaded(true));
  }, []);

  const onSearch = (value: string) => {
    if (documents.length) {
      setDatas(
        documents.filter((d) =>
          strNormalize(d.getTitle()).includes(strNormalize(value))
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
          .sort((a, b) => a.getTitle().localeCompare(b.getTitle()))
          .map((d, i) => (
            <ItemOutline
              key={d.getId() || i}
              id={d.getTitle()}
              name={d.getTitle()}
              title={d.getTitle()}
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