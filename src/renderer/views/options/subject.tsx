import {
    type Dispatch,
    type FC,
    type PointerEvent,
    type SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import {
    Card,
    Input,
    Space,
    App as AntApp,
    Button,
    Dropdown,
    Empty,
    Spin,
    Tooltip,
    message,
    Typography,
} from 'antd';
import { useTranslation } from 'react-i18next';
import {
    type SubjectDocument,
    type SubjectDocumentItem,
    isParagraphReference,
} from '@shared/types';

import { DeleteBtn } from '@renderer/components/delete-btn';
import { AutoFocusInput } from '@renderer/components/auto-focus-input';
import { useDocumentTabsStore, useSubjectsStore } from '@renderer/stores';
import {
    BookOutlined,
    DeleteOutlined,
    EditOutlined,
    FilePdfOutlined,
    HolderOutlined,
    MoreOutlined,
} from '@ant-design/icons';
import { BibleIcons } from '@renderer/components/icons';
import { SUBJECT_EVENT, AI_DATA_EVENT, type FocusSubjectDetail } from '@renderer/utils/events';
import { searchList } from '@renderer/utils/searchable';
import { interactiveProps } from '@renderer/utils/interactive';
import {
    buildPendingNavigation,
    useDocumentPresentation,
    useOpenDocumentRequest,
    useSermonLookup,
    useFormatSermonDate,
} from '@renderer/hooks';
import { getSubjectPageHelp } from './components/option-help-content';
import OptionPageLayout from './components/option-page-layout';

const { Text } = Typography;

function ModalNewSubject({
    onSaveNewSubject,
}: {
    onSaveNewSubject: (searchValue: string) => void;
}) {
    const { t } = useTranslation();
    const searchValue = useRef<string>('');
    const { modal } = AntApp.useApp();

    const openModal = useCallback(() => {
        const onSave = () => onSaveNewSubject(searchValue.current);
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
    }, [modal, onSaveNewSubject, t]);

    return (
        <Button type="primary" onClick={openModal}>
            {t('Créer un sujet')}
        </Button>
    );
}

function SubjectToolbar({
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

export function useSubjectsData() {
    const odata = useRef<SubjectDocument[]>([]);
    const [data, setData] = useState<SubjectDocument[]>([]);
    const setSubjects = useSubjectsStore((s) => s.setSubjects);

    const onSearch = useCallback(
        (value: string) => {
            if (odata.current.length) {
                setData(searchList(odata.current, value, (d) => d.name));
            }
        },
        [setData],
    );

    return { odata, data, setData, setSubjects, onSearch };
}

function normalizeSubjectSelection(
    subjects: SubjectDocument[],
    preferredId?: string | null,
): SubjectDocument[] {
    if (subjects.length === 0) {
        return subjects;
    }

    const activeId =
        preferredId && subjects.some((subject) => subject.id === preferredId)
            ? preferredId
            : (subjects.find((subject) => subject.active)?.id ?? subjects[0].id);

    return subjects.map((subject) => ({
        ...subject,
        active: subject.id === activeId,
    }));
}

export default function Subject() {
    const { t } = useTranslation();
    const { odata, data, setData, setSubjects, onSearch } = useSubjectsData();
    const [subjectItemsData, setSubjectItemData] = useState<SubjectDocumentItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    const loadSubjects = useCallback(() => {
        window.api.subjects
            .getAll()
            .then((subjects) => {
                const preferredId = odata.current.find((subject) => subject.active)?.id ?? null;
                const normalized = normalizeSubjectSelection(subjects, preferredId);
                odata.current = normalized;
                setData(normalized);
                setSubjects(normalized);
            })
            .catch(() => {
                message.error(t('Erreur lors du chargement des sujets'));
            });
    }, [odata, setData, setSubjects, t]);

    useEffect(() => {
        loadSubjects();
    }, [loadSubjects]);

    // Bump this to force subject items to reload (e.g. after sync)
    const [itemsRefreshKey, setItemsRefreshKey] = useState(0);

    useEffect(() => {
        const onChanged = () => {
            loadSubjects();
            setItemsRefreshKey((k) => k + 1);
        };
        window.addEventListener(AI_DATA_EVENT.subjectsChanged, onChanged);
        return () => window.removeEventListener(AI_DATA_EVENT.subjectsChanged, onChanged);
    }, [loadSubjects]);

    useEffect(() => {
        const focusSubject = (event: Event) => {
            const id = (event as CustomEvent<FocusSubjectDetail>).detail?.id;
            if (!id) return;
            const normalized = normalizeSubjectSelection(odata.current, id);
            odata.current = normalized;
            setData(normalized);
            setSubjects(normalized);
        };
        window.addEventListener(SUBJECT_EVENT.focusSubject, focusSubject);
        return () => window.removeEventListener(SUBJECT_EVENT.focusSubject, focusSubject);
    }, [odata, setData, setSubjects]);

    const activeDocument = useMemo(() => data.find((d) => d.active), [data]);
    const activeSubjectId = activeDocument?.id;

    useEffect(() => {
        if (!activeSubjectId) {
            setSubjectItemData([]);
            setLoadingItems(false);
            return;
        }

        let cancelled = false;
        setSubjectItemData([]);
        setLoadingItems(true);

        window.api.subjects
            .getItems(activeSubjectId)
            .then((items) => {
                if (cancelled) return;
                setSubjectItemData(items);
            })
            .catch(() => {
                if (cancelled) return;
                message.error(t('Erreur lors du chargement des éléments du sujet'));
            })
            .finally(() => {
                if (!cancelled) setLoadingItems(false);
            });

        return () => {
            cancelled = true;
        };
    }, [activeSubjectId, itemsRefreshKey, t]);
    const refPanelRef = useRef<HTMLDivElement>(null);

    // Reset reference panel scroll when switching subjects
    useEffect(() => {
        requestAnimationFrame(() => {
            if (refPanelRef.current) {
                refPanelRef.current.scrollTop = 0;
            }
        });
    }, [activeDocument?.id]);

    const onSelectItem = useCallback(
        (id: string) => {
            const normalized = normalizeSubjectSelection(odata.current, id);
            odata.current = normalized;
            setData(normalized);
            setSubjects(normalized);
        },
        [odata, setData, setSubjects],
    );

    const saveNewSubject = (searchValue: string) => {
        const value = searchValue.trim();
        if (value.length < 2 || odata.current.some((d) => d.name === value)) return;

        window.api.subjects
            .create(value)
            .then((subject) => {
                const active = { ...subject, active: true };
                odata.current = [active, ...odata.current.map((d) => ({ ...d, active: false }))];
                setData(odata.current);
                setSubjects(odata.current);
                message.success(t('Sujet créé'));
            })
            .catch(() => {
                message.error(t('Un sujet avec ce nom existe déjà.'));
            });
    };

    const handleSubjectDeletion = (item: SubjectDocument) => {
        window.api.subjects.delete(item.id).then(() => {
            odata.current = normalizeSubjectSelection(
                odata.current.filter((d) => d.id !== item.id),
            );
            setData(odata.current);
            setSubjects(odata.current);
            message.success(t('Supprimé'));
        });
    };

    const { modal } = AntApp.useApp();

    const handleSubjectRename = useCallback(
        (item: SubjectDocument) => {
            const nameRef = { value: item.name };
            modal.info({
                closable: true,
                icon: null,
                okText: t('Enregistrer'),
                title: t('Renommer le sujet'),
                content: (
                    <AutoFocusInput
                        size="large"
                        minLength={2}
                        defaultValue={item.name}
                        onChange={(e) => {
                            nameRef.value = e.target.value;
                        }}
                    />
                ),
                onOk: () => {
                    const newName = nameRef.value.trim();
                    if (
                        newName.length < 2 ||
                        newName === item.name ||
                        odata.current.some((d) => d.name === newName)
                    )
                        return;

                    window.api.subjects.rename(item.id, newName).then(() => {
                        odata.current = odata.current.map((d) =>
                            d.id === item.id ? { ...d, name: newName } : d,
                        );
                        setData([...odata.current]);
                        setSubjects(odata.current);
                        message.success(t('Sujet renommé'));
                    });
                },
            });
        },
        [modal, t, odata, setData, setSubjects],
    );

    return (
        <OptionPageLayout title={t('Sujets')} help={getSubjectPageHelp(t)}>
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
                        <SubjectToolbar onSaveNewSubject={saveNewSubject} onSearch={onSearch} />
                    </Card>
                    <div
                        className="container-y mt-2"
                        style={{ flex: 1, minHeight: 0, padding: '22px', overflowX: 'hidden' }}
                    >
                        <AnimatePresence mode="popLayout">
                            {data.map((item) => (
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
                                        onRenameSubject={handleSubjectRename}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
                <div
                    ref={refPanelRef}
                    className="container-y"
                    style={{ flex: 1, minHeight: 0, padding: '0 10px' }}
                >
                    {activeDocument && (
                        <ShowActiveDocuments
                            subject={activeDocument}
                            documents={subjectItemsData}
                            setDocuments={setSubjectItemData}
                            loading={loadingItems}
                        />
                    )}
                </div>
            </div>
        </OptionPageLayout>
    );
}

function ItemFromSelectedSubject({
    item,
    confirm,
    onDragHandlePointerDown,
}: {
    item: SubjectDocumentItem;
    confirm: (item: SubjectDocumentItem) => void;
    onDragHandlePointerDown: (event: PointerEvent) => void;
}) {
    const { getSermonById } = useSermonLookup();
    const formatDate = useFormatSermonDate();
    const setPendingNavigation = useDocumentTabsStore((s) => s.setPendingNavigation);
    const openDocumentRequest = useOpenDocumentRequest();
    const { buildOpenRequest, resolveTitle } = useDocumentPresentation();

    const documentIdentity = item.documentReference.documentIdentity;
    const sermon =
        documentIdentity.documentType === 'sermon'
            ? getSermonById(documentIdentity.sermonId)
            : undefined;
    const displayTitle = resolveTitle(item.documentTitle, item.documentReference);
    const paragraphRef = isParagraphReference(item.documentReference)
        ? item.documentReference
        : null;
    const paragraphNum = paragraphRef ? paragraphRef.paragraphIndex : null;

    const onNavigate = () => {
        const request = buildOpenRequest(item.documentTitle, item.documentReference);
        setPendingNavigation(buildPendingNavigation(request, item.documentReference));
        openDocumentRequest(request);
    };

    if (item.documentPreview?.kind === 'bible-verse') {
        const verse = item.documentPreview.bibleVerse;
        return (
            <div className="subject-ref-card">
                <div className="subject-ref-card__header">
                    <HolderOutlined
                        onPointerDown={onDragHandlePointerDown}
                        style={{
                            fontSize: 'var(--fs-base)',
                            cursor: 'grab',
                            opacity: 0.5,
                            flexShrink: 0,
                            touchAction: 'none',
                        }}
                    />
                    <BibleIcons />
                    <Text strong style={{ fontSize: 'var(--fs-rel-4xl)' }}>
                        {verse.bookName} {verse.chapter}:{verse.verse}
                    </Text>
                    <DeleteBtn confirm={() => confirm(item)} />
                </div>
                <div className="subject-ref-card__body">{verse.content}</div>
            </div>
        );
    }

    return (
        <div className="subject-ref-card">
            <div className="subject-ref-card__header">
                <HolderOutlined
                    onPointerDown={onDragHandlePointerDown}
                    style={{
                        fontSize: 'var(--fs-base)',
                        cursor: 'grab',
                        opacity: 0.5,
                        flexShrink: 0,
                        touchAction: 'none',
                    }}
                />
                <BookOutlined style={{ fontSize: 'var(--fs-base)' }} />
                <a className="underline" style={{ flex: 1, fontSize: 'var(--fs-rel-4xl)' }}>
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

function SubjectDocumentReorderItem({
    item,
    confirm,
    persistOrder,
}: {
    item: SubjectDocumentItem;
    confirm: (item: SubjectDocumentItem) => void;
    persistOrder: () => Promise<void>;
}) {
    const dragControls = useDragControls();

    return (
        <Reorder.Item
            key={item.id}
            value={item}
            as="div"
            layout="position"
            dragListener={false}
            dragControls={dragControls}
            transition={{
                layout: {
                    duration: 0.28,
                    ease: [0.22, 1, 0.36, 1],
                },
            }}
            onDragEnd={() => void persistOrder()}
        >
            <ItemFromSelectedSubject
                item={item}
                confirm={confirm}
                onDragHandlePointerDown={(event) => dragControls.start(event)}
            />
        </Reorder.Item>
    );
}

function ShowActiveDocuments({
    subject,
    documents,
    setDocuments,
    loading,
}: {
    subject: SubjectDocument;
    documents: SubjectDocumentItem[];
    setDocuments: Dispatch<SetStateAction<SubjectDocumentItem[]>>;
    loading: boolean;
}) {
    const { t } = useTranslation();
    const documentsRef = useRef(documents);
    const persistedOrderRef = useRef(documents.map((item) => item.id));
    const localReorderRef = useRef(false);

    useEffect(() => {
        documentsRef.current = documents;
    }, [documents]);

    useEffect(() => {
        if (localReorderRef.current) {
            localReorderRef.current = false;
            return;
        }

        persistedOrderRef.current = documents.map((item) => item.id);
    }, [documents, subject.id]);

    function confirm(item: SubjectDocumentItem) {
        window.api.subjects.deleteItem(item.id).then(() => {
            setDocuments((ds) => ds.filter((d) => d.id !== item.id));
            message.success(t('Supprimé'));
        });
    }

    const handleExportPdf = useCallback(async () => {
        try {
            const result = await window.api.subjects.exportPdf(subject.id);
            if (result.status === 'success') {
                message.success(t('PDF exporté avec succès'));
            }
        } catch (err) {
            console.error('Subject PDF export failed:', err);
            message.error(t("Erreur lors de l'export PDF"));
        }
    }, [subject.id, t]);

    const handleReorder = useCallback(
        (nextDocuments: SubjectDocumentItem[]) => {
            localReorderRef.current = true;
            documentsRef.current = nextDocuments;
            setDocuments(nextDocuments);
        },
        [setDocuments],
    );

    const persistOrder = useCallback(async () => {
        const nextIds = documentsRef.current.map((item) => item.id);
        const previousIds = persistedOrderRef.current;
        const changed =
            nextIds.length !== previousIds.length ||
            nextIds.some((id, index) => id !== previousIds[index]);

        if (!changed) {
            return;
        }

        try {
            await window.api.subjects.reorderItems(subject.id, nextIds);
            persistedOrderRef.current = nextIds;
        } catch {
            setDocuments((current) => {
                const byId = new Map(current.map((item) => [item.id, item] as const));
                return persistedOrderRef.current
                    .map((id) => byId.get(id))
                    .filter((item): item is SubjectDocumentItem => !!item);
            });
            message.error(t('Erreur lors de la réorganisation des références'));
        }
    }, [setDocuments, subject.id, t]);

    const content = (
        <>
            {documents.length > 0 ? (
                <Reorder.Group
                    axis="y"
                    values={documents}
                    onReorder={handleReorder}
                    as="div"
                    className="subject-ref-list"
                >
                    {documents.map((item) => (
                        <SubjectDocumentReorderItem
                            key={item.id}
                            item={item}
                            confirm={confirm}
                            persistOrder={persistOrder}
                        />
                    ))}
                </Reorder.Group>
            ) : (
                <Empty
                    description={t('Aucune référence trouvée dans le sujet: {{name}}', {
                        name: subject.name,
                    })}
                />
            )}
        </>
    );

    return (
        <>
            <div className="flex flex-center" style={{ gap: 8 }}>
                <Text type="secondary">
                    {subject.name} ({documents.length})
                </Text>
                <Tooltip title={t('Exporter en PDF')}>
                    <Button
                        type="text"
                        size="small"
                        icon={<FilePdfOutlined />}
                        onClick={handleExportPdf}
                        aria-label={t('Exporter en PDF')}
                    />
                </Tooltip>
            </div>

            {loading ? (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        padding: '32px 0',
                    }}
                >
                    <Spin />
                </div>
            ) : (
                content
            )}
        </>
    );
}

const ItemSubject: FC<{
    item: SubjectDocument;
    onSelectItem: (id: string) => void;
    onDeleteSubject: (item: SubjectDocument) => void;
    onRenameSubject: (item: SubjectDocument) => void;
}> = ({ item, onSelectItem, onDeleteSubject, onRenameSubject }) => {
    const { t } = useTranslation();
    const { modal } = AntApp.useApp();

    const onSelect = useCallback(() => {
        if (!item.active) onSelectItem(item.id);
    }, [item, onSelectItem]);

    const confirmDelete = useCallback(() => {
        modal.confirm({
            title: t('Confirmer la suppression?'),
            okText: t('Oui'),
            cancelText: t('Non'),
            onOk: () => onDeleteSubject(item),
        });
    }, [item, onDeleteSubject, modal, t]);

    const menuItems = useMemo(
        () => [
            {
                key: 'rename',
                label: t('Renommer'),
                icon: <EditOutlined />,
                onClick: () => onRenameSubject(item),
            },
            {
                key: 'delete',
                label: t('Supprimer'),
                icon: <DeleteOutlined />,
                danger: true,
                onClick: confirmDelete,
            },
        ],
        [item, onRenameSubject, confirmDelete, t],
    );

    return (
        <div
            className={`subject-item ${item.active ? 'subject-item--active' : ''}`}
            {...interactiveProps(onSelect)}
            title={item.name}
        >
            <div className="subject-item__left">
                <BookOutlined style={{ fontSize: 'var(--fs-base)', flexShrink: 0 }} />
                <span className="subject-item__name">{item.name}</span>
            </div>
            <span onClick={(e) => e.stopPropagation()}>
                <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                    <Button shape="circle" icon={<MoreOutlined />} />
                </Dropdown>
            </span>
        </div>
    );
};
