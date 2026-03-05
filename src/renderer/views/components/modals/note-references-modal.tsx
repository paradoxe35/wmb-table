import { Button, List, Modal, Tooltip } from 'antd';
import { useEffect, useRef, useState } from 'react';
import {
    type DocumentHtmlTree,
    type ParagraphReference,
    type NoteItem,
    type NoteItemReference,
    isParagraphReference,
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

export function NoteReferencesModal() {
    const title = useActiveTabTitle();
    const titleRef = useValueStateRef(title);

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
                workingNote.current = note as NoteItem;
                const references = await window.api.notes.getReferences(workingNoteId);
                setDatas(references as NoteItemReference[]);
            }
        })();
    }, [workingNoteId, visible]);

    const onSelectItem = (item: NoteItemReference) => {
        if (!documentRefTree.current) return;

        const referenceItem: Partial<NoteItemReference> = {
            documentHtmlTree: documentRefTree.current.documentHtmlTree,
            documentTitle: titleRef.current || '',
            textContent: documentRefTree.current.textContent,
        };

        window.api.notes.updateReference(item.id, referenceItem);

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
                        <span>R\u00e9f\u00e9rences(note: {workingNote.current.name})</span>
                    ) : (
                        <span>Aucune note est actuellement s\u00e9lectionn\u00e9e</span>
                    )}
                </div>
            }
            footer={[]}
            visible={visible}
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
    const { getSermon } = useSermonLookup();

    return (
        <>
            <List
                itemLayout="horizontal"
                dataSource={datas}
                renderItem={(item, i) => {
                    const ref = item.documentHtmlTree;
                    const assigned = ref
                        ? isParagraphReference(ref) || (ref.tree || []).length > 0
                        : false;
                    return (
                        <List.Item
                            actions={[
                                <Tooltip
                                    key={item.id || i}
                                    title="Ajouter \u00e0 cette r\u00e9f\u00e9rence"
                                >
                                    <Button
                                        onClick={() => onSelectItem(item)}
                                        shape="circle"
                                        icon={<SelectOutlined />}
                                    />
                                </Tooltip>,
                            ]}
                        >
                            <List.Item.Meta
                                avatar={<BookOutlined />}
                                description={
                                    assigned
                                        ? `R\u00e9f\u00e9renc\u00e9 \u00e0: ${getSermon(item.documentTitle)?.title || item.documentTitle}`
                                        : 'Aucun document attribu\u00e9 \u00e0 cette r\u00e9f\u00e9rence'
                                }
                                title={
                                    <a onClick={() => onSelectItem(item)}>
                                        <span>{item.label}</span>
                                    </a>
                                }
                            />
                        </List.Item>
                    );
                }}
            />
        </>
    );
}
