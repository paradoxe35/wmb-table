import { Col, Divider, message, Modal, Row, Space, Typography } from 'antd';
import { type Dispatch, type SetStateAction, useRef, useState, useCallback } from 'react';
import { useSermonStore } from '@renderer/stores';
import { useDocumentViewOpen } from '@renderer/components/viewer/document-viewer';
import { FileOutlined } from '@ant-design/icons';
import {
    BibleBook,
    NoteItem,
    NoteItemReference,
    NoteItemReferenceBible,
    isParagraphReference,
} from '@shared/types';
import { BibleContent } from '../bible';
import { DeleteBtn } from '@renderer/components/delete-btn';
import { useSermonLookup, useValueStateRef } from '@renderer/hooks';

export const referenceBrandLink = 'http://w.t/#reference-document-';
export const referenceBibleBrandLink = 'http://w.t/#reference-bible-';

export const useShowReferenceDetail = () => {
    const viewDocument = useDocumentViewOpen();
    const setPendingNavigation = useSermonStore((s) => s.setPendingNavigation);

    const { getSermonById } = useSermonLookup();

    const modal = useCallback((reference: NoteItemReference, workingNote: NoteItem) => {
        const ref = reference.documentHtmlTree;
        const assigned = ref ? isParagraphReference(ref) || (ref.tree || []).length > 0 : false;

        const openDocument = () => {
            viewDocument(
                reference.documentTitle,
                () => {
                    if (reference.documentHtmlTree) {
                        setPendingNavigation({
                            documentTitle: reference.documentTitle,
                            documentHtmlTree: reference.documentHtmlTree,
                        });
                    }
                },
                reference.sermonId,
            );
        };

        const sermon = getSermonById(reference.sermonId);
        const displayTitle = sermon?.title ?? reference.documentTitle;

        Modal[assigned ? 'info' : 'warning']({
            closable: true,
            onOk: assigned ? openDocument : undefined,
            okText: assigned ? 'Ouvrir' : 'Fermer',
            title: (
                <span>
                    {workingNote.name} - {reference.label}
                </span>
            ),
            content: assigned ? (
                <div>
                    <p>
                        <Typography.Text type="secondary">
                            <FileOutlined /> Document:
                        </Typography.Text>{' '}
                        {displayTitle}
                    </p>
                    <p>
                        <Typography.Text type="secondary">- </Typography.Text>
                        {(reference.textContent || '').slice(0, 80)}...
                    </p>
                </div>
            ) : (
                <div>
                    <p>Aucun document n&apos;a été attribué pour cette référence</p>
                </div>
            ),
        });
    }, []);

    return modal;
};

export const useBibleReferenceModal = () => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [reference, setReference] = useState<NoteItemReferenceBible>();

    const showModal = (ref: NoteItemReferenceBible) => {
        setReference(ref);
        setIsModalVisible(true);
    };

    const handleOk = () => {
        setIsModalVisible(false);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
    };

    return {
        isModalVisible,
        showModal,
        handleOk,
        handleCancel,
        reference,
        setReference,
    };
};

export function ReferenceBibleModal({
    isModalVisible,
    handleOk,
    handleCancel,
    reference,
    setReference,
}: {
    handleOk: () => void;
    handleCancel: () => void;
    isModalVisible: boolean;
    reference: NoteItemReferenceBible | undefined;
    setReference: Dispatch<SetStateAction<NoteItemReferenceBible | undefined>>;
}) {
    const referenceRef = useValueStateRef(reference);
    const versesRef = useRef<HTMLDivElement | null>(null);

    const handleDeletionRef = (ref: BibleBook) => {
        window.api.notes.removeBibleVerse(referenceRef.current?.id ?? '', ref.id).then(() => {
            setReference((r) => {
                const nr = { ...r } as NoteItemReferenceBible;
                nr.references = (nr.references as BibleBook[])
                    .slice()
                    .filter((f) => f.id !== ref.id);
                return nr;
            });
            message.success('Verset supprimé');
        });
    };

    const onClickVerse = useCallback((refId: string) => {
        const exists = referenceRef.current?.references.some((d) => (d as BibleBook).id == refId);
        if (exists) {
            message.warning('Le verset cliqué existe déjà dans la références !');
            return;
        }
        (
            window.api.notes.addBibleVerse(
                referenceRef.current?.id ?? '',
                refId,
            ) as Promise<BibleBook>
        )
            .then((item) => {
                setReference((r) => {
                    const nr = { ...r } as NoteItemReferenceBible;
                    nr.references = (nr.references as BibleBook[]).slice();
                    nr.references.push(item);
                    return nr;
                });
                message.success('Verset ajouté');
            })
            .finally(() => {
                window.setTimeout(() => {
                    if (versesRef.current) {
                        versesRef.current.scrollTo({
                            behavior: 'smooth',
                            top: versesRef.current.scrollHeight,
                        });
                    }
                }, 500);
            });
    }, []);

    return (
        <>
            <Modal
                width="80%"
                title={
                    <>
                        <Space orientation="horizontal">
                            <span>Références biblique</span>
                            <span>-</span>
                            <div className="flex flex-center">
                                <Typography.Text type="secondary">
                                    {reference && (
                                        <span>
                                            {reference.label} ({reference.references.length})
                                        </span>
                                    )}
                                </Typography.Text>
                            </div>
                        </Space>
                    </>
                }
                open={isModalVisible}
                footer={[]}
                onOk={handleOk}
                onCancel={handleCancel}
            >
                <Row>
                    <Col span={11}>
                        <div
                            ref={versesRef}
                            style={{
                                overflow: 'auto',
                                maxHeight: '400px',
                            }}
                        >
                            {reference &&
                                (reference.references as BibleBook[]).map((ref) => (
                                    <div
                                        key={ref.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            justifyContent: 'space-between',
                                            padding: '8px 0',
                                            borderBottom: '1px solid var(--ant-color-border)',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 500 }}>
                                                {ref.bookName} {ref.chapter}:{ref.verse}
                                            </div>
                                            <div className="content-description">{ref.content}</div>
                                        </div>
                                        <DeleteBtn confirm={() => handleDeletionRef(ref)} />
                                    </div>
                                ))}
                        </div>
                    </Col>
                    <Col span={1}>
                        <Divider style={{ minHeight: '250px' }} orientation="vertical" />
                    </Col>
                    <Col span={12}>
                        <div
                            style={{
                                overflow: 'auto',
                                maxHeight: '400px',
                                paddingRight: '9px',
                            }}
                        >
                            <BibleContent onClick={onClickVerse} />
                        </div>
                    </Col>
                </Row>
            </Modal>
        </>
    );
}
