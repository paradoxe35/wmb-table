import React, { useEffect, useRef, useState } from 'react';
import { Layout } from 'antd';
import { Input, Space, Card } from 'antd';
import ContainerScrollY from '../container-scroll-y';
import { Title } from '../../types';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../../utils/ipc-events';
import DocumentViewer from '../viewer/document-viewer';
import { strNormalize } from '../../utils/functions';
import { useSetRecoilState } from 'recoil';
import { documentTitles } from '../../store';

const { Search } = Input;

const { Sider } = Layout;

export default function SidebarDocuments() {
  const odatas = useRef<Title[]>([]);
  const [datas, setDatas] = useState<Title[]>([]);
  const setDocumentTitles = useSetRecoilState(documentTitles);

  useEffect(() => {
    sendIpcRequest<Title[]>(IPC_EVENTS.title_documents).then((titles) => {
      titles.reverse();
      odatas.current = titles;
      setDatas(titles);
      setDocumentTitles(titles);
    });
  }, []);

  const onSearch = (value: string) => {
    if (odatas.current.length) {
      setDatas(
        odatas.current.filter((d) =>
          strNormalize(d.title).includes(strNormalize(value))
        )
      );
    }
  };

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
        {datas.map((d) => (
          <ItemOutline key={d._id} id={d._id} name={d.title} />
        ))}
      </ContainerScrollY>
    </Sider>
  );
}

const ItemOutline: React.FC<{ name: string; id: string }> = ({ name, id }) => {
  return (
    <DocumentViewer name={name} id={id}>
      <span className="smart-editable" title={name}>
        <u>
          <span></span>
        </u>
        <b className="name">{name} </b>
      </span>
    </DocumentViewer>
  );
};
