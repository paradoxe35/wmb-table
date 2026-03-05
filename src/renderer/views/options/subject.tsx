import {
    type Dispatch,
    type FC,
    type SetStateAction,
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
import type { SubjectDocument, SubjectDocumentItem } from '@shared/types';
import { getDateTime } from '@renderer/utils/functions';
import { DeleteBtn } from '@renderer/components/delete-btn';
import { useSubjectsStore } from '@renderer/stores';
import ContainerScrollY from '@renderer/components/container-scroll-y';
import { BookOutlined } from '@ant-design/icons';
import DocumentViewer from '@renderer/components/viewer/document-viewer';
import { SUBJECT_EVENT } from '@renderer/utils/events';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';
import { useSermonLookup } from '@renderer/hooks';

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
    }, [onSave]);

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
    const setSubjects = useSubjectsStore((s) => s.setSubjects);

    const onSearch = useCallback((value: string) => {
        if (odatas.current.length) {
            setDatas(odatas.current.filter((d) => simpleRegExp(value).test(strNormalize(d.name))));
        }
    }, []);

    return { odatas, datas, setDatas, setSubjects, onSearch };
}

export default function Subject() {
    const { odatas, datas, setDatas, setSubjects, onSearch } = useSubjectsDatas();
    const activeSubject = useSubjectsStore((s) => s.activeSubject);
    const [subjectItemsData, setSubjectItemData] = useState<SubjectDocumentItem[]>([]);

    useEffect(() => {
        (window.api.subjects.getAll() as Promise<SubjectDocument[]>).then((subjects) => {
            odatas.current = subjects;
            setDatas(subjects);
            setSubjects(subjects);
        });
    }, [setSubjects]);

    useEffect(() => {
        if (datas.length > 0) {
            const hasActive = datas.some((d) => d.active);
            if (!hasActive) {
                setDatas((ds) => ds.map((nd, i) => ({ ...nd, active: i === 0 })));
            }
        }
    }, [datas]);

    useEffect(() => {
        const focusSubject = (event: Event) => {
            const name = (event as CustomEvent<{ name: string }>).detail?.name;
            setDatas((ds) => ds.map((nd) => ({ ...nd, active: nd.name === name })));
        };
        window.addEventListener(SUBJECT_EVENT.focusSubject, focusSubject);
        return () => window.removeEventListener(SUBJECT_EVENT.focusSubject, focusSubject);
    }, []);

    useEffect(() => {
        const subject = datas.find((d) => d.active);
        if (subject) {
            (window.api.subjects.getItems(subject.id) as Promise<SubjectDocumentItem[]>).then(
                setSubjectItemData,
            );
        }
    }, [datas, activeSubject]);

    const activeDocument = useMemo(() => datas.find((d) => d.active), [datas]);

    const onSelectItem = useCallback((name: string) => {
        setDatas((ds) => ds.map((nd) => ({ ...nd, active: nd.name === name })));
    }, []);

    const saveNewSubject = (searchValue: string) => {
        const value = searchValue.trim();
        if (value.length < 2 || odatas.current.some((d) => d.name === value)) return;
        const dateTime = getDateTime();

        window.api.subjects.create(value);

        const subject: SubjectDocument = {
            name: value,
            date: dateTime.date,
            active: true,
            documents: [],
        } as unknown as SubjectDocument;

        odatas.current = [subject, ...odatas.current.map((d) => ({ ...d, active: false }))];
        setDatas(odatas.current);
        setSubjects(odatas.current);
    };

    const handleSubjectDeletion = (item: SubjectDocument) => {
        (window.api.subjects.delete(item.id) as Promise<void>).then(() => {
            odatas.current = odatas.current.filter((d) => d.name !== item.name);
            setDatas(odatas.current);
            setSubjects(odatas.current);
        });
    };

    return (
        <Row gutter={16}>
            <Col span={12}>
                <div className="subject-panel">
                    <Card style={{ width: '100%' }}>
                        <Title onSaveNewSubject={saveNewSubject} onSearch={onSearch} />
                    </Card>
                    <ContainerScrollY
                        className="mt-2"
                        style={{ padding: '22px', overflowX: 'hidden' }}
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

function ItemFromSelectedSubject({
    item,
    setSubjectItemSelected,
    confirm,
}: {
    item: SubjectDocumentItem;
    setSubjectItemSelected: (s: SubjectDocumentItem | null) => void;
    confirm: (item: SubjectDocumentItem) => void;
}) {
    const { getSermon } = useSermonLookup();
    const displayTitle = getSermon(item.documentTitle)?.title ?? item.documentTitle;

    return (
        <>
            <List.Item actions={[<DeleteBtn key="delete" confirm={() => confirm(item)} />]}>
                {item.bible ? (
                    <>
                        <List.Item.Meta
                            title={
                                <span>
                                    {item.bible.bookName} {item.bible.chapter}:{item.bible.verse}
                                </span>
                            }
                            description={<span>Référence: Biblique</span>}
                        />
                        <span className="content-description-2">{item.bible.content}</span>
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
                                        {displayTitle}
                                    </DocumentViewer>
                                </a>
                            }
                            description={<span>Référence: Document</span>}
                        />
                        <span className="content-description-2">{item.textContent}...</span>
                    </>
                )}
            </List.Item>
            <Divider />
        </>
    );
}

function ShowActiveDocuments({
    subject,
    documents,
    setDocuments,
}: {
    subject: SubjectDocument;
    documents: SubjectDocumentItem[];
    setDocuments: Dispatch<SetStateAction<SubjectDocumentItem[]>>;
}) {
    const setSubjectItemSelected = useSubjectsStore((s) => s.setSelectedSubjectItem);

    function confirm(item: SubjectDocumentItem) {
        (window.api.subjects.deleteItem(item.id) as Promise<void>).then(() => {
            setDocuments((ds) => ds.filter((d) => d.id !== item.id));
            message.success('Supprimé');
        });
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
                                <ItemFromSelectedSubject
                                    item={item}
                                    confirm={confirm}
                                    setSubjectItemSelected={setSubjectItemSelected}
                                />
                            )}
                        />
                    </div>
                </>
            ) : (
                <Empty description={`Aucune référence touvée dans le suject: ${subject.name}`} />
            )}
        </>
    );
}

const ItemSubject: FC<{
    item: SubjectDocument;
    onSelectItem: (name: string) => void;
    onDeleteSubject: (item: SubjectDocument) => void;
}> = ({ item, onSelectItem, onDeleteSubject }) => {
    const onSelect = useCallback(() => {
        if (!item.active) onSelectItem(item.name);
    }, [item, onSelectItem]);

    return (
        <div
            className={`subject-item ${item.active ? 'active' : ''}`}
            onClick={onSelect}
            title={item.name}
        >
            <div className="o-icon">
                <BookOutlined />
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                <b>{item.name}</b>
                <DeleteBtn confirm={() => onDeleteSubject(item)} />
            </div>
        </div>
    );
};
