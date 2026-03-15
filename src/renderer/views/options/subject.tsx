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
import { AnimatePresence, motion } from 'framer-motion';
import { Card, Input, Space, App as AntApp, Button, Empty, message, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
    type SubjectDocument,
    type SubjectDocumentItem,
    isParagraphReference,
} from '@shared/types';

import { DeleteBtn } from '@renderer/components/delete-btn';
import { useSermonStore, useSubjectsStore } from '@renderer/stores';
import { BookOutlined } from '@ant-design/icons';
import { BibleIcons } from '@renderer/components/icons';
import { SUBJECT_EVENT } from '@renderer/utils/events';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';
import { interactiveProps } from '@renderer/utils/interactive';
import {
    buildReferenceOpenRequest,
    useOpenDocumentRequest,
    useSermonLookup,
    useFormatSermonDate,
} from '@renderer/hooks';

const { Text } = Typography;

function ModalNewSubject({
    onSaveNewSubject,
}: {
    onSaveNewSubject: (searchValue: string) => void;
}) {
    const { t } = useTranslation();
    const searchValue = useRef<string>('');
    const { modal } = AntApp.useApp();

    const onSave = () => onSaveNewSubject(searchValue.current);

    const openModal = useCallback(() => {
        const modalInstance = modal.info({
            closable: true,
            icon: null,
            onOk: onSave,
            okText: t('Enregistrer'),
            title: t('Créer un sujet'),
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
                        placeholder={t('Nom sujet')}
                    />
                </form>
            ),
        });
    }, [onSave, modal, t]);

    return (
        <Button type="primary" onClick={openModal}>
            {t('Créer un sujet')}
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
    const { t } = useTranslation();
    return (
        <Space orientation="horizontal">
            <Input.Search placeholder={t('Recherche')} allowClear onSearch={onSearch} />
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
    const { t } = useTranslation();
    const { odatas, datas, setDatas, setSubjects, onSearch } = useSubjectsDatas();
    const activeSubject = useSubjectsStore((s) => s.activeSubject);
    const [subjectItemsData, setSubjectItemData] = useState<SubjectDocumentItem[]>([]);

    useEffect(() => {
        window.api.subjects
            .getAll()
            .then((subjects) => {
                odatas.current = subjects;
                setDatas(subjects);
                setSubjects(subjects);
            })
            .catch(() => {
                message.error(t('Erreur lors du chargement des sujets'));
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
            window.api.subjects
                .getItems(subject.id)
                .then(setSubjectItemData)
                .catch(() => {
                    message.error(t('Erreur lors du chargement des éléments du sujet'));
                });
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
            message.success(t('Sujet créé'));
        });
    };

    const handleSubjectDeletion = (item: SubjectDocument) => {
        window.api.subjects.delete(item.id).then(() => {
            odatas.current = odatas.current.filter((d) => d.name !== item.name);
            setDatas(odatas.current);
            setSubjects(odatas.current);
            message.success(t('Supprimé'));
        });
    };

    return (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 4 }}>
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    backgroundColor: 'var(--ant-color-bg-container)',
                }}
                className="layout__sidebar"
            >
                <Card style={{ width: '100%', flexShrink: 0, borderRadius: 0 }}>
                    <Title onSaveNewSubject={saveNewSubject} onSearch={onSearch} />
                </Card>
                <div
                    className="container-y mt-2"
                    style={{ flex: 1, minHeight: 0, padding: '22px', overflowX: 'hidden' }}
                >
                    <AnimatePresence mode="popLayout">
                        {datas.map((item) => (
                            <motion.div
                                key={item.name}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ItemSubject
                                    item={item}
                                    onSelectItem={onSelectItem}
                                    onDeleteSubject={handleSubjectDeletion}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
            <div className="container-y" style={{ flex: 1, minHeight: 0, padding: '0 10px' }}>
                {activeDocument && (
                    <ShowActiveDocuments
                        subject={activeDocument}
                        documents={subjectItemsData}
                        setDocuments={setSubjectItemData}
                    />
                )}
            </div>
        </div>
    );
}

function ItemFromSelectedSubject({
    item,
    confirm,
}: {
    item: SubjectDocumentItem;
    confirm: (item: SubjectDocumentItem) => void;
}) {
    const { getSermonById } = useSermonLookup();
    const formatDate = useFormatSermonDate();
    const setPendingNavigation = useSermonStore((s) => s.setPendingNavigation);
    const openDocumentRequest = useOpenDocumentRequest();

    const sermon = getSermonById(item.sermonId);
    const displayTitle = sermon?.title ?? item.documentTitle;
    const paragraphRef = isParagraphReference(item.documentHtmlTree) ? item.documentHtmlTree : null;
    const paragraphNum = paragraphRef ? paragraphRef.paragraphIndex + 1 : null;

    const onNavigate = () => {
        openDocumentRequest(
            buildReferenceOpenRequest(item.documentTitle, item.sermonId, item.documentHtmlTree),
        );
        setPendingNavigation({
            documentTitle: item.documentTitle,
            documentHtmlTree: item.documentHtmlTree,
        });
    };

    if (item.bible) {
        return (
            <div className="subject-ref-card">
                <div className="subject-ref-card__header">
                    <BibleIcons />
                    <Text strong style={{ fontSize: '0.95em' }}>
                        {item.bible.bookName} {item.bible.chapter}:{item.bible.verse}
                    </Text>
                    <DeleteBtn confirm={() => confirm(item)} />
                </div>
                <div className="subject-ref-card__body">{item.bible.content}</div>
            </div>
        );
    }

    return (
        <div className="subject-ref-card">
            <div className="subject-ref-card__header">
                <BookOutlined style={{ fontSize: 14 }} />
                <a className="underline" style={{ flex: 1, fontSize: '0.95em' }}>
                    <span onClick={onNavigate}>{displayTitle}</span>
                </a>
                <DeleteBtn confirm={() => confirm(item)} />
            </div>
            {sermon && (
                <div className="subject-ref-card__meta">
                    {formatDate(sermon.dateMs)}
                    {sermon.location ? ` — ${sermon.location}` : ''}
                </div>
            )}
            {item.textContent && (
                <div className="subject-ref-card__body">
                    {paragraphNum != null && <Text strong>{paragraphNum}.</Text>} {item.textContent}
                </div>
            )}
        </div>
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
    const { t } = useTranslation();
    function confirm(item: SubjectDocumentItem) {
        window.api.subjects.deleteItem(item.id).then(() => {
            setDocuments((ds) => ds.filter((d) => d.id !== item.id));
            message.success(t('Supprimé'));
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
                    <div className="subject-ref-list">
                        <AnimatePresence mode="popLayout">
                            {documents.map((item) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -100 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <ItemFromSelectedSubject item={item} confirm={confirm} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </>
            ) : (
                <Empty
                    description={t('Aucune référence trouvée dans le sujet: {{name}}', {
                        name: subject.name,
                    })}
                />
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
            className={`subject-item ${item.active ? 'subject-item--active' : ''}`}
            {...interactiveProps(onSelect)}
            title={item.name}
        >
            <div className="subject-item__left">
                <BookOutlined style={{ fontSize: 14, flexShrink: 0 }} />
                <span className="subject-item__name">{item.name}</span>
            </div>
            <span onClick={(e) => e.stopPropagation()}>
                <DeleteBtn confirm={() => onDeleteSubject(item)} />
            </span>
        </div>
    );
};
