import { Button, Empty, Modal, Tooltip, Typography, message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    hasReferenceAssignment,
    type NoteItem,
    type NoteItemReference,
    type SubjectRefTree,
} from '@shared/types';
import {
    useSermonLookup,
    useModalVisible,
    useActiveTabTitle,
    useValueStateRef,
} from '@renderer/hooks';
import { BookOutlined, SelectOutlined } from '@ant-design/icons';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';
import { useNotesStore } from '@renderer/stores';

const { Text } = Typography;

export function NoteReferencesModal() {
    const { t } = useTranslation();
    const title = useActiveTabTitle();
    const titleRef = useValueStateRef(title);
    const pendingReference = useRef<SubjectRefTree | null>(null);
    const { visible, hide, setVisible } = useModalVisible();
    const [datas, setDatas] = useState<NoteItemReference[]>([]);
    const workingNote = useRef<NoteItem | null>(null);
    const workingNoteId = useNotesStore((s) => s.workingNoteId);

    useEffect(() => {
        if (!workingNoteId) {
            setDatas([]);
            workingNote.current = null;
            return;
        }
        (async () => {
            const note = await window.api.notes.getById(workingNoteId);
            if (note) {
                workingNote.current = note;
                const references = await window.api.notes.getReferences(workingNoteId);
                setDatas(references);
            }
        })();
    }, [workingNoteId, visible]);

    const onSelectItem = useCallback(
        (item: NoteItemReference) => {
            if (!pendingReference.current) {
                return;
            }

            const referenceItem: SubjectRefTree = {
                documentReference: pendingReference.current.documentReference,
                textContent: pendingReference.current.textContent ?? '',
                documentPreview: pendingReference.current.documentPreview,
            };

            window.api.notes
                .updateReference(item.id, referenceItem, titleRef.current || '')
                .then(() => {
                    message.success(t('Ajouté à la note'));
                })
                .catch(() => {
                    message.error(t("Erreur lors de l'ajout à la note"));
                });
            setVisible(false);
        },
        [titleRef, setVisible, t],
    );

    useEffect(() => {
        const showModal = (e: CustomEventInit<SubjectRefTree>) => {
            pendingReference.current = e.detail ?? null;
            setVisible(true);
        };
        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.addDocumentRefNote, showModal);
        return () => {
            window.removeEventListener(CHILD_PARENT_WINDOW_EVENT.addDocumentRefNote, showModal);
        };
    }, []);

    const modalTitle = workingNote.current ? (
        <div>
            <Text type="secondary" style={{ fontSize: 'var(--fs-rel-xl)', fontWeight: 400 }}>
                {t('Lier ce paragraphe à une référence de la note :')}
            </Text>
            <div>{workingNote.current.name}</div>
        </div>
    ) : (
        <span>{t("Aucune note n'est actuellement sélectionnée")}</span>
    );

    return (
        <Modal title={modalTitle} footer={null} open={visible} onCancel={hide} width={480}>
            <div className="note-ref-select-list">
                {datas.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t('Aucune référence disponible')}
                        style={{ padding: '24px 0' }}
                    />
                ) : (
                    datas.map((item) => (
                        <NoteReferenceItem key={item.id} item={item} onSelect={onSelectItem} />
                    ))
                )}
            </div>
        </Modal>
    );
}

function NoteReferenceItem({
    item,
    onSelect,
}: {
    item: NoteItemReference;
    onSelect: (item: NoteItemReference) => void;
}) {
    const { t } = useTranslation();
    const { getSermonById } = useSermonLookup();

    const ref = item.documentReference;
    const assigned = hasReferenceAssignment(ref);
    const documentIdentity = ref?.documentIdentity;
    const linkedTitle =
        documentIdentity?.documentType === 'sermon'
            ? getSermonById(documentIdentity.sermonId)?.title || item.documentTitle
            : item.documentTitle;

    return (
        <div className="note-ref-select-item" onClick={() => onSelect(item)}>
            <BookOutlined className="note-ref-select-item__icon" />
            <div className="note-ref-select-item__content">
                <Text className="note-ref-select-item__label">{item.label}</Text>
                <Text type="secondary" className="note-ref-select-item__meta">
                    {assigned
                        ? t('Lié à : {{title}}', { title: linkedTitle })
                        : t('Aucun document attribué')}
                </Text>
            </div>
            <Tooltip title={t('Ajouter à cette référence')}>
                <Button
                    type="text"
                    size="small"
                    icon={<SelectOutlined />}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(item);
                    }}
                />
            </Tooltip>
        </div>
    );
}
