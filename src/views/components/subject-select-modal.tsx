import { Divider, Input, Modal, Space } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { subjectDocumentStore, subjectDocumentItemStore } from '../../store';
import {
  SubjectDocument,
  SubjectDocumentItem,
  SubjectRefTree,
} from '../../types';
import { strNormalize } from '../../utils/functions';
import { useModalVisible, useValueStateRef } from '../../utils/hooks';
import { BookOutlined } from '@ant-design/icons';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../../utils/ipc-events';

export function SubjectSelectModal({ title }: { title: string }) {
  const titleRef = useValueStateRef(title);

  const setSubjectItems = useSetRecoilState(subjectDocumentItemStore);

  const documentRefTree = useRef<SubjectRefTree>();

  const {
    isModalVisible,
    handleOk,
    handleCancel,
    setIsModalVisible,
  } = useModalVisible();

  const [datas, setDatas] = useState<SubjectDocument[]>([]);
  const odatas = useRecoilValue<SubjectDocument[]>(subjectDocumentStore);

  const onSelectItem = (name: string) => {
    if (!documentRefTree.current) return;

    const subjectItem: Partial<SubjectDocumentItem> = {
      documentHtmlTree: documentRefTree.current?.documentHtmlTree,
      documentTitle: titleRef.current,
      textContent: documentRefTree.current?.textContent,
      subject: name,
      bible: documentRefTree.current?.bible,
    };

    sendIpcRequest<SubjectDocumentItem>(
      IPC_EVENTS.subject_items_store,
      subjectItem
    ).then((item) => {
      setSubjectItems(item);
      window.dispatchEvent(
        new CustomEvent('focus-subject', { detail: { name } })
      );
    });
    setIsModalVisible(false);
  };

  const onSearch = useCallback(
    (value: string) => {
      if (odatas.length) {
        setDatas(
          odatas.filter((d) =>
            strNormalize(d.name).includes(strNormalize(value))
          )
        );
      }
    },
    [odatas]
  );

  useEffect(() => {
    setDatas(odatas);
  }, [odatas]);

  useEffect(() => {
    const showModal = (e: CustomEventInit<SubjectRefTree>) => {
      documentRefTree.current = e.detail;
      setIsModalVisible(true);
    };

    window.addEventListener('add-document-ref-subject', showModal);
    return () => {
      window.removeEventListener('add-document-ref-subject', showModal);
    };
  }, []);
  return (
    <Modal
      title={
        <Space direction="horizontal">
          <span>Choiser un sujet</span>
          <Search onSearch={onSearch} />
        </Space>
      }
      footer={[]}
      visible={isModalVisible}
      onOk={handleOk}
      onCancel={handleCancel}
    >
      <div style={{ overflow: 'auto', height: '300px' }}>
        <ContentModal onSelectItem={onSelectItem} datas={datas} />
      </div>
    </Modal>
  );
}

function ContentModal({
  onSelectItem,
  datas,
}: {
  onSelectItem: (name: string) => void;
  datas: SubjectDocument[];
}) {
  return (
    <>
      {datas.map((item) => (
        <ItemSubject key={item.name} item={item} onSelectItem={onSelectItem} />
      ))}
    </>
  );
}

const ItemSubject: React.FC<{
  item: SubjectDocument;
  onSelectItem: (name: string) => void;
}> = ({ item, onSelectItem }) => {
  return (
    <>
      <span
        className={`smart-editable big`}
        onClick={() => onSelectItem(item.name)}
        title={item.name}
      >
        <div className="o-icon">
          <BookOutlined />
        </div>
        <b>{item.name}</b>
      </span>
      <Divider style={{ margin: '7px 0' }} />
    </>
  );
};

function Search({ onSearch }: { onSearch: (value: string) => void }) {
  return (
    <Space direction="horizontal">
      <Input.Search placeholder="Recherche" allowClear onSearch={onSearch} />
    </Space>
  );
}
