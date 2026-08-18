import { Empty, Input, Modal, message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SubjectDocument } from '@shared/types';
import { useModalVisible } from '@renderer/hooks';
import { BookOutlined } from '@ant-design/icons';
import {
    CHILD_PARENT_WINDOW_EVENT,
    SUBJECT_EVENT,
    type AddDocumentReferenceDetail,
    type FocusSubjectDetail,
} from '@renderer/utils/events';
import { searchList } from '@renderer/utils/searchable';
import { useSubjectsStore } from '@renderer/stores';

export function SubjectSelectModal() {
    const { t } = useTranslation();
    const pendingReference = useRef<AddDocumentReferenceDetail | null>(null);
    const { visible, hide, setVisible } = useModalVisible();
    const [datas, setDatas] = useState<SubjectDocument[]>([]);
    const subjects = useSubjectsStore((s) => s.subjects);
    const setSubjects = useSubjectsStore((s) => s.setSubjects);

    const refreshSubjects = useCallback(() => {
        return window.api.subjects
            .getAll()
            .then((items) => {
                setSubjects(items);
                return items;
            })
            .catch(() => {
                message.error(t('Erreur lors du chargement des sujets'));
                return [];
            });
    }, [setSubjects, t]);

    const onSelectItem = useCallback(
        (subjectId: string) => {
            if (!pendingReference.current) {
                return;
            }

            const subject = subjects.find((s) => s.id === subjectId);
            if (!subject) {
                return;
            }

            const ref = pendingReference.current;
            const textContent = ref.textContent ?? '';

            window.api.subjects
                .createItem(
                    subject.id,
                    ref.documentTitle,
                    ref.documentReference,
                    textContent,
                    ref.documentPreview,
                )
                .then(() => {
                    const detail: FocusSubjectDetail = { id: subject.id };
                    window.dispatchEvent(
                        new CustomEvent<FocusSubjectDetail>(SUBJECT_EVENT.focusSubject, {
                            detail,
                        }),
                    );
                    pendingReference.current = null;
                    message.success(t('Ajouté au sujet'));
                })
                .catch(() => {
                    message.error(t("Erreur lors de l'ajout au sujet"));
                });
            setVisible(false);
        },
        [subjects, setVisible, t],
    );

    const onSearch = useCallback(
        (value: string) => {
            setDatas(searchList(subjects, value, (d) => d.name));
        },
        [subjects],
    );

    useEffect(() => {
        setDatas(subjects);
    }, [subjects]);

    useEffect(() => {
        if (!visible) {
            return;
        }

        void refreshSubjects().then(setDatas);
    }, [visible, refreshSubjects]);

    useEffect(() => {
        const showModal = (e: CustomEventInit<AddDocumentReferenceDetail>) => {
            pendingReference.current = e.detail ?? null;
            setVisible(true);
        };
        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.addDocumentRefSubject, showModal);
        return () => {
            window.removeEventListener(CHILD_PARENT_WINDOW_EVENT.addDocumentRefSubject, showModal);
        };
    }, [setVisible]);

    const handleClose = useCallback(() => {
        pendingReference.current = null;
        hide();
    }, [hide]);

    return (
        <Modal
            title={t('Ajouter au sujet')}
            footer={null}
            open={visible}
            onCancel={handleClose}
            width={420}
        >
            <Input.Search
                placeholder={t('Rechercher...')}
                allowClear
                onSearch={onSearch}
                onChange={(e) => onSearch(e.target.value)}
                style={{ marginBottom: 12 }}
            />
            <div className="subject-select-list">
                {datas.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t('Aucun sujet')}
                        style={{ padding: '24px 0' }}
                    />
                ) : (
                    datas.map((item) => (
                        <SubjectSelectItem key={item.id} item={item} onSelect={onSelectItem} />
                    ))
                )}
            </div>
        </Modal>
    );
}

const SubjectSelectItem: React.FC<{
    item: SubjectDocument;
    onSelect: (id: string) => void;
}> = ({ item, onSelect }) => {
    return (
        <div className="subject-select-item" onClick={() => onSelect(item.id)} title={item.name}>
            <BookOutlined className="subject-select-item__icon" />
            <span className="subject-select-item__name">{item.name}</span>
        </div>
    );
};
