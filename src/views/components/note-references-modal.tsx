import { Button, List, Modal, Tooltip } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { DocumentHtmlTree, NoteItem, NoteItemReference } from '../../types';
import { useValueStateRef } from '../../utils/hooks';
import { BookOutlined, SelectOutlined } from '@ant-design/icons';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../../utils/ipc-events';
import { useRecoilValue } from 'recoil';
import { titlesDocumentSelector, workingNoteAppStore } from '../../store';

export function NoteReferencesModal({ title }: { title: string }) {
  const titleRef = useValueStateRef(title);
  const documentRefTree = useRef<{
    textContent: string;
    documentHtmlTree: DocumentHtmlTree;
  }>();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const [datas, setDatas] = useState<NoteItemReference[]>([]);
  const workingNote = useRef<NoteItem | null>(null);
  const workingNoteId = useRecoilValue(workingNoteAppStore);

  useEffect(() => {
    if (!workingNoteId) {
      setDatas([]);
      workingNote.current = null;
      return;
    }
    (async () => {
      const note = await sendIpcRequest<NoteItem>(
        IPC_EVENTS.notes_items_get,
        workingNoteId
      );
      if (note) {
        workingNote.current = note;
        const references = await sendIpcRequest<NoteItemReference[]>(
          IPC_EVENTS.notes_references,
          workingNoteId
        );
        setDatas(references);
      }
    })();
  }, [workingNoteId, isModalVisible]);

  const handleOk = () => {
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const onSelectItem = (item: NoteItemReference) => {
    if (!documentRefTree.current) return;

    const referenceItem: Partial<NoteItemReference> = {
      documentHtmlTree: documentRefTree.current.documentHtmlTree,
      documentTitle: titleRef.current,
      textContent: documentRefTree.current.textContent,
    };

    sendIpcRequest(IPC_EVENTS.notes_references_put, item._id, referenceItem);

    setIsModalVisible(false);
  };

  useEffect(() => {
    const showModal = (e: CustomEventInit) => {
      documentRefTree.current = e.detail;
      setIsModalVisible(true);
    };

    window.addEventListener('add-document-ref-note', showModal);
    return () => {
      window.removeEventListener('add-document-ref-note', showModal);
    };
  }, []);

  return (
    <Modal
      title={
        <span>
          {workingNote.current ? (
            <span>Références(note: {workingNote.current.name})</span>
          ) : (
            <span>Aucune note est actuellement sélectionnée</span>
          )}
        </span>
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
  onSelectItem: (item: NoteItemReference) => void;
  datas: NoteItemReference[];
}) {
  const $titles = useRecoilValue(titlesDocumentSelector);

  return (
    <>
      <List
        itemLayout="horizontal"
        dataSource={datas}
        renderItem={(item) => {
          const assigned = (item.documentHtmlTree.tree || []).length > 0;
          return (
            <List.Item
              actions={[
                <Tooltip title="Ajouter à cette référence">
                  <Button
                    onClick={() => onSelectItem(item)}
                    shape="circle"
                    icon={<SelectOutlined />}
                  />
                </Tooltip>,
              ]}
            >
              <List.Item.Meta
                avatar={<BookOutlined />}
                description={
                  assigned
                    ? `Référencé à: ${$titles[item.documentTitle]?.name}`
                    : 'Aucun document attribué à cette référence'
                }
                title={
                  <a onClick={() => onSelectItem(item)}>
                    <span>{item.label}</span>
                  </a>
                }
              />
            </List.Item>
          );
        }}
      />
    </>
  );
}
