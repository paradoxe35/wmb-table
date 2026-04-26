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
import { BibleBook, NoteItemReferenceBible } from '@shared/types';
import { BibleContent } from '../bible';
import { DeleteBtn } from '@renderer/components/delete-btn';
import { useValueStateRef } from '@renderer/hooks';
import { AnimatePresence, motion } from 'framer-motion';

export const referenceBrandLink = 'http://w.t/#reference-document-';
export const referenceBibleBrandLink = 'http://w.t/#reference-bible-';

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

    const onClickVerse = useCallback(
        (refId: string) => {
            const exists = referenceRef.current?.references.some(
                (d) => (d as BibleBook).id == refId,
            );
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
        },
        [referenceRef, setReference, t],
    );

    const verses = reference ? (reference.references as BibleBook[]) : [];
    const [showBible, setShowBible] = useState(false);

    // Pick an initial Bible-picker visibility when the modal opens or a different reference is
    // shown — but never re-toggle on verse add/remove (that would close the picker mid-add).
    useEffect(() => {
        if (!isModalVisible) return;
        const initialHasVerses = (referenceRef.current?.references?.length ?? 0) > 0;
        setShowBible(!initialHasVerses);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isModalVisible, reference?.id]);

    return (
        <Modal
            width={showBible ? '80%' : undefined}
            title={
                <div>
                    <div
                        style={{
                            fontSize: 'var(--fs-sm)',
                            fontWeight: 400,
                            color: 'var(--ant-color-text-secondary)',
                        }}
                    >
                        {t('Référence Bible')}
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
                        <AnimatePresence mode="popLayout" initial={false}>
                            {verses.map((ref) => (
                                <motion.div
                                    key={ref.id}
                                    layout="position"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{
                                        opacity: { duration: 0.22, ease: 'easeOut' },
                                        layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                                    }}
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
                                </motion.div>
                            ))}
                        </AnimatePresence>
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
