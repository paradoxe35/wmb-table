import { App as AntApp, Badge, Button, Empty, message, Modal, Tooltip, Typography } from 'antd';
import {
    type Dispatch,
    type SetStateAction,
    useEffect,
    useRef,
    useState,
    useCallback,
} from 'react';
import { useTranslation } from 'react-i18next';
import { BookOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useDocumentTabsStore } from '@renderer/stores';
import {
    BibleBook,
    NoteItemReference,
    NoteItemReferenceBible,
    hasReferenceAssignment,
    isParagraphReference,
} from '@shared/types';
import { BibleContent } from '../bible';
import { DeleteBtn } from '@renderer/components/delete-btn';
import {
    buildPendingNavigation,
    useDocumentPresentation,
    useFormatSermonDate,
    useOpenDocumentRequest,
    useSermonLookup,
    useValueStateRef,
} from '@renderer/hooks';
import { motion } from 'framer-motion';

export const referenceBrandLink = 'http://w.t/#reference-document-';
export const referenceBibleBrandLink = 'http://w.t/#reference-bible-';

export const useShowReferenceDetail = () => {
    const { t } = useTranslation();
    const { modal: appModal } = AntApp.useApp();
    const openDocumentRequest = useOpenDocumentRequest();
    const { buildOpenRequest, resolveTitle } = useDocumentPresentation();
    const setPendingNavigation = useDocumentTabsStore((s) => s.setPendingNavigation);

    const { getSermonById } = useSermonLookup();
    const formatDate = useFormatSermonDate();

    const showReferenceDetail = useCallback(
        (reference: NoteItemReference) => {
            const ref = reference.documentReference;
            const assigned = hasReferenceAssignment(ref);
            const documentIdentity = ref?.documentIdentity;

            const openDocument = () => {
                if (reference.documentReference) {
                    const request = buildOpenRequest(
                        reference.documentTitle,
                        reference.documentReference,
                    );
                    setPendingNavigation(
                        buildPendingNavigation(request, reference.documentReference),
                    );
                    openDocumentRequest(request);
                }
            };

            const sermon =
                documentIdentity?.documentType === 'sermon'
                    ? getSermonById(documentIdentity.sermonId)
                    : undefined;
            const displayTitle = documentIdentity
                ? resolveTitle(reference.documentTitle, reference.documentReference)
                : reference.documentTitle;
            const paragraphRef = ref && isParagraphReference(ref) ? ref : null;
            const paragraphNum = paragraphRef ? paragraphRef.paragraphIndex : null;

            appModal[assigned ? 'info' : 'warning']({
                closable: true,
                onOk: assigned ? openDocument : undefined,
                okText: assigned ? t('Ouvrir le document') : t('Fermer'),
                title: (
                    <span style={{ fontSize: 'var(--fs-md)', fontWeight: 500 }}>
                        {t('Référence: {{label}}', { label: reference.label })}
                    </span>
                ),
                content: assigned ? (
                    <div>
                        <span style={{ fontWeight: 600, fontSize: 'var(--fs-xl)' }}>
                            {displayTitle}
                        </span>
                        {sermon && (
                            <p
                                style={{
                                    fontSize: 'var(--fs-rel-xl)',
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
        },
        [
            buildOpenRequest,
            appModal,
            formatDate,
            getSermonById,
            openDocumentRequest,
            resolveTitle,
            setPendingNavigation,
            t,
        ],
    );

    return showReferenceDetail;
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

    const toggleBible = () => setShowBible((v) => !v);

    return (
        <Modal
            width={showBible ? 920 : 560}
            title={
                <div className="bible-ref-modal__header">
                    <span className="bible-ref-modal__eyebrow">{t('Référence Bible')}</span>
                    <div className="bible-ref-modal__title-row">
                        <span className="bible-ref-modal__title">{reference?.label ?? ''}</span>
                        <Badge
                            count={verses.length}
                            showZero
                            color={verses.length > 0 ? undefined : 'var(--ant-color-fill)'}
                            style={{ color: 'var(--ant-color-text-secondary)' }}
                        />
                    </div>
                </div>
            }
            open={isModalVisible}
            footer={[
                <Button
                    key="toggle"
                    type={showBible ? 'primary' : 'default'}
                    icon={showBible ? <EyeInvisibleOutlined /> : <BookOutlined />}
                    onClick={toggleBible}
                    style={{ float: 'left' }}
                >
                    {showBible ? t('Masquer la Bible') : t('Afficher la Bible')}
                </Button>,
                <Button key="close" onClick={handleCancel}>
                    {t('Fermer')}
                </Button>,
            ]}
            onOk={handleOk}
            onCancel={handleCancel}
        >
            <div className={`bible-ref-modal__body ${showBible ? 'is-split' : ''}`}>
                <section className="bible-ref-modal__verses">
                    <h4 className="bible-ref-modal__section-label">{t('Versets sélectionnés')}</h4>
                    <div ref={versesRef} className="bible-ref-modal__verse-list">
                        {verses.length === 0 ? (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={t('Aucun verset sélectionné')}
                            />
                        ) : null}
                        {verses.map((ref) => (
                            <VerseRow
                                key={ref.id}
                                verse={ref}
                                onDelete={() => handleDeletionRef(ref)}
                            />
                        ))}
                    </div>
                </section>
                {showBible && (
                    <section className="bible-ref-modal__picker">
                        <h4 className="bible-ref-modal__section-label">{t('Choisir un verset')}</h4>
                        <div className="bible-ref-modal__picker-scroll">
                            <BibleContent onClick={onClickVerse} compact />
                        </div>
                    </section>
                )}
            </div>
        </Modal>
    );
}

function VerseRow({ verse, onDelete }: { verse: BibleBook; onDelete: () => void }) {
    const { t } = useTranslation();
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.18 }}
            className="bible-ref-modal__verse-row"
        >
            <Typography.Text strong className="bible-ref-modal__verse-ref">
                {verse.bookName} {verse.chapter}:{verse.verse}
            </Typography.Text>
            <span className="bible-ref-modal__verse-text">{verse.content}</span>
            <Tooltip title={t('Supprimer')}>
                <span className="bible-ref-modal__verse-actions">
                    <DeleteBtn confirm={onDelete} />
                </span>
            </Tooltip>
        </motion.div>
    );
}
