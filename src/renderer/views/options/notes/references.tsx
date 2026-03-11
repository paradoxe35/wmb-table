import { Button, Col, message, Modal, Row, Typography } from 'antd';
import {
    type Dispatch,
    type SetStateAction,
    useEffect,
    useRef,
    useState,
    useCallback,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PlusOutlined } from '@ant-design/icons';
import { useSermonStore } from '@renderer/stores';
import { useDocumentViewOpen } from '@renderer/components/viewer/document-viewer';
import {
    BibleBook,
    NoteItemReference,
    NoteItemReferenceBible,
    isParagraphReference,
} from '@shared/types';
import { BibleContent } from '../bible';
import { DeleteBtn } from '@renderer/components/delete-btn';
import { useSermonLookup, useFormatSermonDate, useValueStateRef } from '@renderer/hooks';

export const referenceBrandLink = 'http://w.t/#reference-document-';
export const referenceBibleBrandLink = 'http://w.t/#reference-bible-';

export const useShowReferenceDetail = () => {
    const { t } = useTranslation();
    const viewDocument = useDocumentViewOpen();
    const setPendingNavigation = useSermonStore((s) => s.setPendingNavigation);

    const { getSermonById } = useSermonLookup();
    const formatDate = useFormatSermonDate();

    const modal = useCallback((reference: NoteItemReference) => {
        const ref = reference.documentHtmlTree;
        const assigned = ref ? isParagraphReference(ref) || (ref.tree || []).length > 0 : false;

        const refTranslationId = ref && isParagraphReference(ref) ? ref.translationId : undefined;

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
                refTranslationId,
            );
        };

        const sermon = getSermonById(reference.sermonId);
        const displayTitle = sermon?.title ?? reference.documentTitle;
        const paragraphRef = ref && isParagraphReference(ref) ? ref : null;
        const paragraphNum = paragraphRef ? paragraphRef.paragraphIndex + 1 : null;

        Modal[assigned ? 'info' : 'warning']({
            closable: true,
            onOk: assigned ? openDocument : undefined,
            okText: assigned ? t('Ouvrir le document') : t('Fermer'),
            title: (
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {t('Référence: {{label}}', { label: reference.label })}
                </span>
            ),
            content: assigned ? (
                <div>
                    <span style={{ fontWeight: 600, fontSize: 17 }}>{displayTitle}</span>
                    {sermon && (
                        <p
                            style={{
                                fontSize: '0.85em',
                                color: 'var(--ant-color-text-secondary)',
                                marginTop: 5,
                            }}
                        >
                            {formatDate(sermon.dateMs)}
                            {sermon.location ? ` — ${sermon.location}` : ''}
                        </p>
                    )}
                    {reference.textContent && (
                        <p>
                            {paragraphNum != null && (
                                <Typography.Text strong>{paragraphNum}.</Typography.Text>
                            )}{' '}
                            {reference.textContent}
                        </p>
                    )}
                </div>
            ) : (
                <div>
                    <p>{t("Aucun document n'a été attribué pour cette référence")}</p>
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
    const { t } = useTranslation();
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
            message.success(t('Verset supprimé'));
        });
    };

    const onClickVerse = useCallback((refId: string) => {
        const exists = referenceRef.current?.references.some((d) => (d as BibleBook).id == refId);
        if (exists) {
            message.warning(t('Le verset cliqué existe déjà dans la références !'));
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
                message.success(t('Verset ajouté'));
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

    const verses = reference ? (reference.references as BibleBook[]) : [];
    const hasVerses = verses.length > 0;
    const [showBible, setShowBible] = useState(false);

    // Reset bible picker visibility when modal opens/closes or reference changes
    useEffect(() => {
        setShowBible(!hasVerses);
    }, [isModalVisible, reference?.id]);

    return (
        <Modal
            width={showBible ? '80%' : undefined}
            title={
                <div>
                    <div
                        style={{
                            fontSize: 12,
                            fontWeight: 400,
                            color: 'var(--ant-color-text-secondary)',
                        }}
                    >
                        {t('Référence biblique')}
                    </div>
                    {reference && (
                        <div>
                            {reference.label} ({verses.length})
                        </div>
                    )}
                </div>
            }
            open={isModalVisible}
            footer={[]}
            onOk={handleOk}
            onCancel={handleCancel}
        >
            <Row gutter={showBible ? 16 : 0}>
                <Col span={showBible ? 11 : 24}>
                    <div ref={versesRef} style={{ overflow: 'auto', maxHeight: 400 }}>
                        {verses.length === 0 && !showBible && (
                            <Typography.Text type="secondary">
                                {t('Aucun verset sélectionné')}
                            </Typography.Text>
                        )}
                        {verses.map((ref) => (
                            <div
                                key={ref.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 8,
                                    padding: '10px 0',
                                    borderBottom: '1px solid var(--ant-color-border)',
                                }}
                            >
                                <DeleteBtn confirm={() => handleDeletionRef(ref)} />
                                <div>
                                    <span style={{ color: 'var(--ant-color-text-secondary)' }}>
                                        {ref.bookName} {ref.chapter}:{ref.verse}
                                    </span>
                                    {' — '}
                                    <span>{ref.content}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {!showBible && (
                        <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={() => setShowBible(true)}
                            style={{ marginTop: 12 }}
                            block
                        >
                            {t('Ajouter des versets')}
                        </Button>
                    )}
                </Col>
                {showBible && (
                    <Col span={13}>
                        <div style={{ overflow: 'auto', maxHeight: 400 }}>
                            <BibleContent onClick={onClickVerse} compact />
                        </div>
                    </Col>
                )}
            </Row>
        </Modal>
    );
}
