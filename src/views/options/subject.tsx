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
} from 'antd';
import { SubjectDocument } from '../../types';
import { useSetRecoilState } from 'recoil';
import { subjectDocument } from '../../store';
import sendIpcRequest from '../../message-control/ipc/ipc-renderer';
import { IPC_EVENTS } from '../../utils/ipc-events';
import { getDateTime, strNormalize } from '../../utils/functions';
import { useValueStateRef } from '../../utils/hooks';

function ModalNewSubject({
  setDatas,
  odatas,
}: {
  setDatas: React.Dispatch<React.SetStateAction<SubjectDocument[]>>;
  odatas: React.MutableRefObject<SubjectDocument[]>;
}) {
  const searchValue = useValueStateRef<string>('');
  const setSubjectDocument = useSetRecoilState(subjectDocument);

  const onSave = () => {
    const value = searchValue.current.trim();
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
  setDatas,
  odatas,
}: {
  onSearch: (value: string) => void;
  setDatas: React.Dispatch<React.SetStateAction<SubjectDocument[]>>;
  odatas: React.MutableRefObject<SubjectDocument[]>;
}) {
  return (
    <Space direction="horizontal">
      <Input.Search placeholder="Recherche" allowClear onSearch={onSearch} />
      <div />
      <ModalNewSubject setDatas={setDatas} odatas={odatas} />
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

  return (
    <Row>
      <Col span={12}>
        <Card
          title={
            <Title setDatas={setDatas} odatas={odatas} onSearch={onSearch} />
          }
          style={{ width: '95%', minHeight: '300px' }}
        >
          <ShowSubjectList datas={datas} onSelect={onSelectItem} />
        </Card>
      </Col>
      <Col span={12}>
        {activeDocument && <ShowActiveDocuments subject={activeDocument} />}
      </Col>
    </Row>
  );
}

function ShowActiveDocuments({ subject }: { subject: SubjectDocument }) {
  const documents = subject.documents;
  return (
    <>
      {documents.length > 0 ? (
        <> </>
      ) : (
        <Empty description={`Aucun touvé dans le suject: ${subject.name}`} />
      )}
    </>
  );
}

const ShowSubjectList: React.FC<{
  datas: SubjectDocument[];
  onSelect: (name: string) => void;
}> = ({ datas, onSelect }) => {
  return (
    <>
      {datas.map((item) => (
        <ItemOutline key={item.name} item={item} onSelectItem={onSelect} />
      ))}
    </>
  );
};

const ItemOutline: React.FC<{
  item: SubjectDocument;
  onSelectItem: (name: string) => void;
}> = ({ item, onSelectItem }) => {
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
          <b style={{ paddingRight: '20px' }}>{item.documents.length}</b>
        </div>
      </span>
      <Divider style={{ margin: '7px 0' }} />
    </>
  );
};
