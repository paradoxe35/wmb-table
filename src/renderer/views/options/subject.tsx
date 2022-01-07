import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Row,
  Col,
  Card,
  Input,
  Space,
  Button,
  Modal,
  Divider,
  Empty,
  message,
  List,
  Typography,
} from 'antd';
import { SubjectDocument, SubjectDocumentItem } from '@localtypes/index';
import sendIpcRequest from '@root/ipc/ipc-renderer';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import { getDateTime } from '@root/utils/functions';
import { DeleteBtn } from '@renderer/components/delete-btn';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import {
  selectedSubjectDocumentItemStore,
  subjectDocumentStore,
  subjectDocumentItemStore,
  titlesDocumentSelector,
} from '@renderer/store';
import ContainerScrollY from '@renderer/components/container-scroll-y';
import { BookOutlined } from '@ant-design/icons';
import DocumentViewer from '@renderer/components/viewer/document-viewer';
import { SUBJECT_EVENT } from '@modules/shared/shared';
import { simpleRegExp, strNormalize } from '@modules/shared/searchable';

const { Text } = Typography;

function ModalNewSubject({
  onSaveNewSubject,
}: {
  onSaveNewSubject: (searchValue: string) => void;
}) {
  const searchValue = useRef<string>('');

  const onSave = () => onSaveNewSubject(searchValue.current);

  const modal = useCallback(() => {
    const modalInstance = Modal.info({
      closable: true,
      icon: null,
      onOk: onSave,
      okText: 'Enregistrer',
      title: 'Créer un sujet',
      content: (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
            modalInstance.destroy();
          }}
        >
          <Input
            autoFocus={true}
            size="large"
            minLength={3}
            allowClear
            onKeyUp={(e) => (searchValue.current = e.currentTarget.value)}
            placeholder="Nom sujet"
          />
        </form>
      ),
    });
  }, []);

  return (
    <Button type="primary" onClick={modal}>
      Créer un sujet
    </Button>
  );
}

function Title({
  onSearch,
  onSaveNewSubject,
}: {
  onSearch: (value: string) => void;
  onSaveNewSubject: (searchValue: string) => void;
}) {
  return (
    <Space direction="horizontal">
      <Input.Search placeholder="Recherche" allowClear onSearch={onSearch} />
      <div />
      <ModalNewSubject onSaveNewSubject={onSaveNewSubject} />
    </Space>
  );
}

export function useSubjectsDatas() {
  const odatas = useRef<SubjectDocument[]>([]);
  const [datas, setDatas] = useState<SubjectDocument[]>([]);
  const setSubjectDocument = useSetRecoilState(subjectDocumentStore);

  const onSearch = useCallback((value: string) => {
    if (odatas.current.length) {
      setDatas(
        odatas.current.filter((d) =>
          simpleRegExp(value).test(strNormalize(d.name))
        )
      );
    }
  }, []);

  return { odatas, datas, setDatas, setSubjectDocument, onSearch };
}

export default function Subject() {
  const {
    odatas,
    datas,
    setDatas,
    setSubjectDocument,
    onSearch,
  } = useSubjectsDatas();

  const subjectItems = useRecoilValue(subjectDocumentItemStore);

  const [subjectItemsData, setSubjectItemData] = useState<
    SubjectDocumentItem[]
  >([]);

  useEffect(() => {
    sendIpcRequest<SubjectDocument[]>(IPC_EVENTS.subject_document).then(
      (subjects) => {
        odatas.current = subjects;
        setDatas(subjects);
        setSubjectDocument(subjects);
      }
    );
  }, []);

  useEffect(() => {
    if (datas.length > 0) {
      const hasActive = datas.some((d) => d.active);
      if (!hasActive) {
        setDatas((ds) => {
          return ds.map((nd, i) => {
            const d = { ...nd };
            d.active = i == 0;
            return d;
          });
        });
      }
    }
  }, [datas]);

  useEffect(() => {
    const focusSubject = (event: CustomEventInit<{ name: string }>) => {
      setDatas((ds) => {
        return ds.map((nd) => {
          const d = { ...nd };
          d.active = d.name == event.detail?.name;
          return d;
        });
      });
    };
    window.addEventListener(SUBJECT_EVENT.focusSubject, focusSubject);
    return () => {
      window.removeEventListener(SUBJECT_EVENT.focusSubject, focusSubject);
    };
  }, []);

  useEffect(() => {
    const subject = datas.find((d) => d.active);
    if (subject) {
      sendIpcRequest<SubjectDocumentItem[]>(
        IPC_EVENTS.subject_items,
        subject.name
      ).then((items) => {
        setSubjectItemData(items);
      });
    }
  }, [datas, subjectItems]);

  const activeDocument = useMemo(() => datas.find((d) => d.active), [datas]);

  const onSelectItem = useCallback((name: string) => {
    setDatas((ds) => {
      return ds.map((nd) => {
        const d = { ...nd };
        d.active = nd.name === name;
        return d;
      });
    });
  }, []);

  const saveNewSubject = (searchValue: string) => {
    const value = searchValue.trim();
    if (value.length < 2 || odatas.current.some((d) => d.name === value)) {
      return;
    }
    const dateTime = getDateTime();
    //@ts-ignore
    const subject: SubjectDocument = {
      name: value,
      date: dateTime.date,
      active: true,
      documents: [],
    };

    sendIpcRequest<SubjectDocument[]>(IPC_EVENTS.subject_document, {
      name: value,
      date: dateTime.date,
    });

    odatas.current = [
      subject,
      ...odatas.current.map((d) => {
        const nd = { ...d };
        nd.active = false;
        return nd;
      }),
    ];
    setDatas(odatas.current);
    setSubjectDocument(odatas.current);
  };

  const handleSubjectDeletion = (item: SubjectDocument) => {
    sendIpcRequest<boolean>(IPC_EVENTS.subject_document_delete, item.name).then(
      (deleted) => {
        if (!deleted) return;
        odatas.current = odatas.current.filter((d) => d.name != item.name);
        setDatas(odatas.current);
        setSubjectDocument(odatas.current);
      }
    );
  };

  return (
    <Row>
      <Col span={12}>
        <div
          style={{ width: '95%', minHeight: '300px', backgroundColor: '#fff' }}
          className="layout__sidebar"
        >
          <Card style={{ width: '100%' }}>
            <Title onSaveNewSubject={saveNewSubject} onSearch={onSearch} />
          </Card>
          <ContainerScrollY
            className="mt-2"
            style={{
              padding: '22px',
              overflowX: 'hidden',
            }}
          >
            <List
              itemLayout="vertical"
              style={{ width: '100%' }}
              dataSource={datas}
              renderItem={(item) => (
                <ItemSubject
                  key={item.name}
                  item={item}
                  onSelectItem={onSelectItem}
                  onDeleteSubject={handleSubjectDeletion}
                />
              )}
            />
          </ContainerScrollY>
        </div>
      </Col>
      <Col span={12}>
        <ContainerScrollY susDiff={10} style={{ padding: '0 10px' }}>
          {activeDocument && (
            <ShowActiveDocuments
              subject={activeDocument}
              documents={subjectItemsData}
              setDocuments={setSubjectItemData}
            />
          )}
        </ContainerScrollY>
      </Col>
    </Row>
  );
}

function ShowActiveDocuments({
  subject,
  documents,
  setDocuments,
}: {
  subject: SubjectDocument;
  documents: SubjectDocumentItem[];
  setDocuments: React.Dispatch<React.SetStateAction<SubjectDocumentItem[]>>;
}) {
  const setSubjectItemSelected = useSetRecoilState(
    selectedSubjectDocumentItemStore
  );

  const $titles = useRecoilValue(titlesDocumentSelector);

  function confirm(item: SubjectDocumentItem) {
    sendIpcRequest<boolean>(IPC_EVENTS.subject_items_delete, item._id).then(
      (deleted) => {
        if (!deleted) return;
        setDocuments((ds) => ds.filter((d) => d._id !== item._id));
        message.success('Supprimé');
      }
    );
  }

  return (
    <>
      {documents.length > 0 ? (
        <>
          <div className="flex flex-center">
            <Text type="secondary">
              {subject.name} ({documents.length})
            </Text>
          </div>
          <div className="mt-2 flex flex-center">
            <List
              itemLayout="vertical"
              size="small"
              style={{ width: '100%' }}
              dataSource={documents}
              renderItem={(item) => (
                <>
                  <List.Item
                    actions={[<DeleteBtn confirm={() => confirm(item)} />]}
                  >
                    {item.bible ? (
                      <>
                        <List.Item.Meta
                          title={
                            <span>
                              {item.bible.bookName} {item.bible.chapter}:
                              {item.bible.verse}
                            </span>
                          }
                          description={<span>Référence: Biblique</span>}
                        />
                        <span className="content-description-2">
                          {item.bible.content}
                        </span>
                      </>
                    ) : (
                      <>
                        <List.Item.Meta
                          title={
                            <a className="underline">
                              <DocumentViewer
                                onItemClick={() => setSubjectItemSelected(item)}
                                name={item.documentTitle}
                              >
                                {$titles[item.documentTitle]?.getTitle()}
                              </DocumentViewer>
                            </a>
                          }
                          description={<span>Référence: Document</span>}
                        />
                        <span className="content-description-2">
                          {item.textContent}...
                        </span>
                      </>
                    )}
                  </List.Item>
                  <Divider />
                </>
              )}
            />
          </div>
        </>
      ) : (
        <Empty
          description={`Aucune référence touvée dans le suject: ${subject.name}`}
        />
      )}
    </>
  );
}

const ItemSubject: React.FC<{
  item: SubjectDocument;
  onSelectItem: (name: string) => void;
  onDeleteSubject: (item: SubjectDocument) => void;
}> = ({ item, onSelectItem, onDeleteSubject }) => {
  //
  const onSelect = useCallback(() => {
    !item.active && onSelectItem(item.name);
  }, [item, onSelectItem]);

  return (
    <>
      <span
        className={`smart-editable big ${item.active ? 'active' : ''}`}
        onClick={onSelect}
        title={item.name}
      >
        <div className="o-icon">
          <BookOutlined />
        </div>
        <div
          style={{
            width: '100%',
            display: 'inline-flex',
            justifyContent: 'space-between',
          }}
        >
          <b>{item.name}</b>
          <b style={{ paddingRight: '20px' }}>
            <DeleteBtn confirm={() => onDeleteSubject(item)} />
          </b>
        </div>
      </span>
      <Divider style={{ margin: '7px 0' }} />
    </>
  );
};
