import {
  Col,
  Divider,
  List,
  message,
  Modal,
  Row,
  Space,
  Typography,
} from 'antd';
import React, { useRef, useState } from 'react';
import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { useDocumentViewOpen } from '../../../components/viewer/document-viewer';
import sendIpcRequest from '../../../message-control/ipc/ipc-renderer';
import {
  selectedSubjectDocumentItemStore,
  titlesDocumentSelector,
} from '../../../store';
import { FileOutlined } from '@ant-design/icons';
import {
  BibleBook,
  NoteItem,
  NoteItemReference,
  NoteItemReferenceBible,
} from '../../../types';
import { IPC_EVENTS } from '../../../utils/ipc-events';
import { BibleContent } from '../bible';
import { DeleteBtn } from '../../../components/delete-btn';
import { useValueStateRef } from '../../../utils/hooks';

export const referenceBrandLink = 'http://w.t/#reference-document-';
export const referenceBibleBrandLink = 'http://w.t/#reference-bible-';

export const useShowReferenceDetail = () => {
  const viewDocument = useDocumentViewOpen();
  const setSubjectItemSelected = useSetRecoilState(
    selectedSubjectDocumentItemStore
  );
  const $titles = useRecoilValue(titlesDocumentSelector);

  const modal = useCallback(
    (reference: NoteItemReference, workingNote: NoteItem) => {
      const assigned = (reference.documentHtmlTree?.tree || []).length > 0;

      const openDocument = () => {
        viewDocument(reference.documentTitle, () => {
          //@ts-ignore
          setSubjectItemSelected({
            subject: '',
            documentHtmlTree: reference.documentHtmlTree,
            documentTitle: reference.documentTitle,
            textContent: reference.textContent,
          });
        });
      };

      Modal[assigned ? 'info' : 'warning']({
        closable: true,
        onOk: assigned ? openDocument : undefined,
        okText: assigned ? 'Ouvrir' : 'Fermer',
        title: (
          <span>
            {workingNote.name} - {reference.label}
          </span>
        ),
        content: assigned ? (
          <div>
            <p>
              <Typography.Text type="secondary">
                <FileOutlined /> Document:
              </Typography.Text>{' '}
              {$titles[reference.documentTitle]?.name}
            </p>
            <p>
              <Typography.Text type="secondary">- </Typography.Text>
              {(reference.textContent || '').slice(0, 80)}...
            </p>
          </div>
        ) : (
          <div>
            <p>Aucun document n'a été attribué pour cette référence</p>
          </div>
        ),
      });
    },
    []
  );

  return modal;
};

export const useBibleReferenceModal = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [reference, setReference] = useState<NoteItemReferenceBible>();

  const showModal = (ref: NoteItemReferenceBible) => {
    setReference(ref);
    setIsModalVisible(true);
  };

  const handleOk = () => {
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  return {
    isModalVisible,
    showModal,
    handleOk,
    handleCancel,
    reference,
    setReference,
  };
};

export function ReferenceBibleModal({
  isModalVisible,
  handleOk,
  handleCancel,
  reference,
  setReference,
}: {
  handleOk: () => void;
  handleCancel: () => void;
  isModalVisible: boolean;
  reference: NoteItemReferenceBible | undefined;
  setReference: React.Dispatch<
    React.SetStateAction<NoteItemReferenceBible | undefined>
  >;
}) {
  const referenceRef = useValueStateRef(reference);
  const versesRef = useRef<HTMLDivElement | null>(null);

  const handleDeletionRef = (ref: BibleBook) => {
    sendIpcRequest(
      IPC_EVENTS.notes_references_bible_remove,
      referenceRef.current?._id,
      ref._id
    ).then(() => {
      setReference((r) => {
        const nr = { ...r } as NoteItemReferenceBible;
        nr.references = (nr.references as BibleBook[])
          .slice()
          .filter((f) => f._id !== ref._id);
        return nr;
      });
    });
  };

  const onClickVerse = useCallback((refId: string) => {
    const exists = referenceRef.current?.references.some(
      (d) => (d as BibleBook)._id == refId
    );
    if (exists) {
      message.warning('Le verset cliqué existe déjà dans la références !');
      return;
    }
    sendIpcRequest<BibleBook>(
      IPC_EVENTS.notes_references_bible_add,
      referenceRef.current?._id,
      refId
    )
      .then((item) => {
        setReference((r) => {
          const nr = { ...r } as NoteItemReferenceBible;
          nr.references = (nr.references as BibleBook[]).slice();
          nr.references.push(item);
          return nr;
        });
      })
      .finally(() => {
        window.setTimeout(() => {
          if (versesRef.current) {
            versesRef.current.scrollTo({
              behavior: 'smooth',
              top: versesRef.current.scrollHeight,
            });
          }
        }, 500);
      });
  }, []);

  return (
    <>
      <Modal
        width="80%"
        title={
          <>
            <Space direction="horizontal">
              <span>Références biblique</span>
              <span>-</span>
              <div className="flex flex-center">
                <Typography.Text type="secondary">
                  {reference && (
                    <span>
                      {reference.label} ({reference.references.length})
                    </span>
                  )}
                </Typography.Text>
              </div>
            </Space>
          </>
        }
        visible={isModalVisible}
        footer={[]}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <Row>
          <Col span={11}>
            <div
              ref={versesRef}
              style={{
                overflow: 'auto',
                maxHeight: '400px',
              }}
            >
              {reference && (
                <List
                  itemLayout="horizontal"
                  dataSource={reference.references as BibleBook[]}
                  renderItem={(ref) => (
                    <List.Item
                      actions={[
                        <DeleteBtn confirm={() => handleDeletionRef(ref)} />,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <span>
                            {ref.bookName} {ref.chapter}:{ref.verse}
                          </span>
                        }
                        description={
                          <span style={{ fontSize: '1.2em' }}>
                            {ref.content}
                          </span>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </div>
          </Col>
          <Col span={1}>
            <Divider style={{ minHeight: '250px' }} type="vertical" />
          </Col>
          <Col span={12}>
            <div
              style={{
                overflow: 'auto',
                maxHeight: '400px',
                paddingRight: '9px',
              }}
            >
              <BibleContent onClick={onClickVerse} />
            </div>
          </Col>
        </Row>
      </Modal>
    </>
  );
}
