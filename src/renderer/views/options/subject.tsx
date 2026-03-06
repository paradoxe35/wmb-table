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
    List,
    message,
    Typography,
} from 'antd';
import type { SubjectDocument, SubjectDocumentItem } from '@shared/types';

import { DeleteBtn } from '@renderer/components/delete-btn';
import { useSermonStore, useSubjectsStore } from '@renderer/stores';
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
        <Space orientation="horizontal">
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
        window.api.subjects.getAll().then((subjects) => {
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
            window.api.subjects.getItems(subject.id).then(setSubjectItemData);
        }
    }, [datas, activeSubject]);

    const activeDocument = useMemo(() => datas.find((d) => d.active), [datas]);

    const onSelectItem = useCallback((name: string) => {
        setDatas((ds) => ds.map((nd) => ({ ...nd, active: nd.name === name })));
    }, []);

    const saveNewSubject = (searchValue: string) => {
        const value = searchValue.trim();
        if (value.length < 2 || odatas.current.some((d) => d.name === value)) return;

        window.api.subjects.create(value).then((subject) => {
            const active = { ...subject, active: true };
            odatas.current = [active, ...odatas.current.map((d) => ({ ...d, active: false }))];
            setDatas(odatas.current);
            setSubjects(odatas.current);
        });
    };

    const handleSubjectDeletion = (item: SubjectDocument) => {
        window.api.subjects.delete(item.id).then(() => {
            odatas.current = odatas.current.filter((d) => d.name !== item.name);
            setDatas(odatas.current);
            setSubjects(odatas.current);
        });
    };

    return (
        <Row>
            <Col span={12}>
                <div
                    style={{
                        width: '95%',
                        minHeight: '300px',
                        backgroundColor: 'var(--ant-color-bg-container)',
                    }}
                    className="layout__sidebar"
                >
                    <Card style={{ width: '100%' }}>
                        <Title onSaveNewSubject={saveNewSubject} onSearch={onSearch} />
                    </Card>
                    <ContainerScrollY
                        className="mt-2"
                        style={{ padding: '22px', overflowX: 'hidden' }}
                    >
                        {datas.map((item) => (
                            <ItemSubject
                                key={item.name}
                                item={item}
                                onSelectItem={onSelectItem}
                                onDeleteSubject={handleSubjectDeletion}
                            />
                        ))}
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
    confirm,
}: {
    item: SubjectDocumentItem;
    confirm: (item: SubjectDocumentItem) => void;
}) {
    const { getSermon } = useSermonLookup();
    const setPendingNavigation = useSermonStore((s) => s.setPendingNavigation);
    const displayTitle = getSermon(item.documentTitle)?.title ?? item.documentTitle;

    const onNavigate = () => {
        setPendingNavigation({
            documentTitle: item.documentTitle,
            documentHtmlTree: item.documentHtmlTree,
        });
    };

    const title = item.bible ? (
        <span>
            {item.bible.bookName} {item.bible.chapter}:{item.bible.verse}
        </span>
    ) : (
        <a className="underline">
            <DocumentViewer onItemClick={onNavigate} name={item.documentTitle}>
                {displayTitle}
            </DocumentViewer>
        </a>
    );

    const description = item.bible ? (
        <>
            <div>Référence: Biblique</div>
            <span className="content-description-2">{item.bible.content}</span>
        </>
    ) : (
        <>
            <div>Référence: Document</div>
            <span className="content-description-2">{item.textContent}...</span>
        </>
    );

    return (
        <List.Item actions={[<DeleteBtn key="delete" confirm={() => confirm(item)} />]}>
            <List.Item.Meta title={title} description={description} />
        </List.Item>
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
    function confirm(item: SubjectDocumentItem) {
        window.api.subjects.deleteItem(item.id).then(() => {
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
                    <List
                        className="mt-2"
                        itemLayout="vertical"
                        dataSource={documents}
                        renderItem={(item) => (
                            <ItemFromSelectedSubject key={item.id} item={item} confirm={confirm} />
                        )}
                    />
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
        <>
            <span
                className={`smart-editable big ${item.active ? 'active' : ''}`}
                onClick={onSelect}
                title={item.name}
            >
                <div className="o-icon">
                    <BookOutlined />
                </div>
                <b>{item.name}</b>
                <DeleteBtn confirm={() => onDeleteSubject(item)} />
            </span>
            <Divider style={{ margin: '4px 0' }} />
        </>
    );
};
