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
} from 'antd';
import { SubjectDocument, SubjectDocumentItem } from '../../types';
import { useSetRecoilState } from 'recoil';
import { subjectDocument } from '../../store';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../../utils/ipc-events';
import { getDateTime, strNormalize } from '../../utils/functions';
import { useValueStateRef } from '../../utils/hooks';
import { DeleteBtn } from '../../components/delete-btn';

function ModalNewSubject({
  onSaveNewSubject,
}: {
  onSaveNewSubject: (searchValue: string) => void;
}) {
  const searchValue = useValueStateRef<string>('');

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

export default function Subject() {
  const odatas = useRef<SubjectDocument[]>([]);
  const [datas, setDatas] = useState<SubjectDocument[]>([]);
  const setSubjectDocument = useSetRecoilState(subjectDocument);

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
    const subject = datas.find((d) => d.active);
    if (subject) {
      sendIpcRequest<SubjectDocumentItem[]>(
        IPC_EVENTS.subject_items,
        subject.name
      ).then((items) => {
        setDatas((its) =>
          its.map((sj) => {
            const nsj = { ...sj };
            nsj.documents = items;
            return nsj;
          })
        );
      });
    }
  }, [datas]);

  const onSearch = useCallback((value: string) => {
    if (odatas.current.length) {
      setDatas(
        odatas.current.filter((d) =>
          strNormalize(d.name).includes(strNormalize(value))
        )
      );
    }
  }, []);

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
        <Card
          title={
            <Title onSaveNewSubject={saveNewSubject} onSearch={onSearch} />
          }
          style={{ width: '95%', minHeight: '300px' }}
        >
          {datas.map((item) => (
            <ItemOutline
              key={item.name}
              item={item}
              onSelectItem={onSelectItem}
              onDeleteSubject={handleSubjectDeletion}
            />
          ))}
        </Card>
      </Col>
      <Col span={12}>
        {activeDocument && (
          <ShowActiveDocuments subject={activeDocument} setDatas={setDatas} />
        )}
      </Col>
    </Row>
  );
}

function ShowActiveDocuments({
  subject,
  setDatas,
}: {
  subject: SubjectDocument;
  setDatas: React.Dispatch<React.SetStateAction<SubjectDocument[]>>;
}) {
  const documents = subject.documents;

  function confirm(item: SubjectDocumentItem) {
    sendIpcRequest<boolean>(IPC_EVENTS.subject_items_delete, item._id).then(
      (deleted) => {
        if (!deleted) return;
        setDatas((its) =>
          its.map((sj) => {
            const nsj = { ...sj };
            nsj.documents = nsj.documents.filter(
              (d) => d.documentTitle !== item.documentTitle
            );
            return nsj;
          })
        );
        message.success('Supprimé');
      }
    );
  }

  return (
    <>
      {documents.length > 0 ? (
        <List
          className="demo-loadmore-list"
          itemLayout="horizontal"
          dataSource={documents}
          renderItem={(item) => (
            <>
              <List.Item
                actions={[<DeleteBtn confirm={() => confirm(item)} />]}
              >
                <List.Item.Meta
                  title={<a>item.documentTitle</a>}
                  description={subject.name}
                />
                <span>{item.textContent}...</span>
              </List.Item>
              <Divider />
            </>
          )}
        />
      ) : (
        <Empty description={`Aucun touvé dans le suject: ${subject.name}`} />
      )}
    </>
  );
}

const ItemOutline: React.FC<{
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
        <u>
          <span></span>
        </u>
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
