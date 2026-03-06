import { Button, Modal, Tooltip, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import {
    type DocumentHtmlTree,
    type ParagraphReference,
    type NoteItem,
    type NoteItemReference,
    type SubjectRefTree,
    isParagraphReference,
} from '@shared/types';
import { useSermonLookup, useModalVisible } from '@renderer/hooks';
import { BookOutlined, SelectOutlined } from '@ant-design/icons';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';
import { useNotesStore } from '@renderer/stores';

export function NoteReferencesModal() {
    const documentRefTree = useRef<
        | {
              textContent: string;
              documentHtmlTree: DocumentHtmlTree | ParagraphReference;
          }
        | undefined
    >(undefined);

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

    const onSelectItem = (item: NoteItemReference) => {
        if (!documentRefTree.current) return;

        const referenceItem: SubjectRefTree = {
            documentHtmlTree: documentRefTree.current.documentHtmlTree,
            textContent: documentRefTree.current.textContent ?? '',
        };

        window.api.notes.updateReference(item.id, referenceItem);
        message.success('Ajouté à la note');

        setVisible(false);
    };

    useEffect(() => {
        const showModal = (e: CustomEventInit) => {
            documentRefTree.current = e.detail;
            setVisible(true);
        };

        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.addDocumentRefNote, showModal);
        return () => {
            window.removeEventListener(CHILD_PARENT_WINDOW_EVENT.addDocumentRefNote, showModal);
        };
    }, []);

    return (
        <Modal
            title={
                <div className="mr-2">
                    {workingNote.current ? (
                        <span>Références(note: {workingNote.current.name})</span>
                    ) : (
                        <span>Aucune note est actuellement sélectionnée</span>
                    )}
                </div>
            }
            footer={[]}
            open={visible}
            onOk={hide}
            onCancel={hide}
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
    const { getSermonById } = useSermonLookup();

    return (
        <>
            {datas.map((item, i) => {
                const ref = item.documentHtmlTree;
                const assigned = ref
                    ? isParagraphReference(ref) || (ref.tree || []).length > 0
                    : false;
                return (
                    <div
                        key={item.id || i}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 0',
                            borderBottom: '1px solid var(--ant-color-border)',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer',
                                flex: 1,
                            }}
                            onClick={() => onSelectItem(item)}
                        >
                            <BookOutlined />
                            <div>
                                <div>
                                    <a>{item.label}</a>
                                </div>
                                <div
                                    style={{
                                        fontSize: '0.85em',
                                        color: 'var(--ant-color-text-secondary)',
                                    }}
                                >
                                    {assigned
                                        ? `Référencé à: ${getSermonById(item.sermonId)?.title || item.documentTitle}`
                                        : 'Aucun document attribué à cette référence'}
                                </div>
                            </div>
                        </div>
                        <Tooltip title="Ajouter à cette référence">
                            <Button
                                onClick={() => onSelectItem(item)}
                                shape="circle"
                                icon={<SelectOutlined />}
                            />
                        </Tooltip>
                    </div>
                );
            })}
        </>
    );
}
