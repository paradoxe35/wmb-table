import { Empty, Input, Modal, message } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SubjectDocument, SubjectRefTree } from '@shared/types';
import { useModalVisible, useActiveTabTitle, useValueStateRef } from '@renderer/hooks';
import { BookOutlined } from '@ant-design/icons';
import { CHILD_PARENT_WINDOW_EVENT, SUBJECT_EVENT } from '@renderer/utils/events';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';
import { useDocumentTabsStore, useSubjectsStore, selectActiveTab } from '@renderer/stores';

export function SubjectSelectModal() {
    const { t } = useTranslation();
    const title = useActiveTabTitle();
    const titleRef = useValueStateRef(title);
    const activeTab = useDocumentTabsStore(selectActiveTab);
    const documentRefTree = useRef<SubjectRefTree | undefined>(undefined);
    const { visible, hide, setVisible } = useModalVisible();
    const [datas, setDatas] = useState<SubjectDocument[]>([]);
    const subjects = useSubjectsStore((s) => s.subjects);

    const onSelectItem = useCallback(
        (subjectId: string) => {
            if (!documentRefTree.current) {
                return;
            }

            const subject = subjects.find((s) => s.id === subjectId);
            if (!subject) {
                return;
            }

            const ref = documentRefTree.current;
            const documentHtmlTree = ref.documentHtmlTree ?? { tree: [] };
            const textContent = ref.textContent ?? '';

            window.api.subjects
                .createItem(
                    subject.id,
                    titleRef.current || '',
                    documentHtmlTree,
                    textContent,
                    ref.bible,
                    activeTab?.documentId,
                )
                .then(() => {
                    window.dispatchEvent(
                        new CustomEvent(SUBJECT_EVENT.focusSubject, {
                            detail: { id: subject.id },
                        }),
                    );
                    message.success(t('Ajouté au sujet'));
                })
                .catch(() => {
                    message.error(t("Erreur lors de l'ajout au sujet"));
                });
            setVisible(false);
        },
        [subjects, titleRef, activeTab, setVisible, t],
    );

    const onSearch = useCallback(
        (value: string) => {
            if (!value.trim()) {
                setDatas(subjects);
                return;
            }
            setDatas(subjects.filter((d) => simpleRegExp(value).test(strNormalize(d.name))));
        },
        [subjects],
    );

    useEffect(() => {
        setDatas(subjects);
    }, [subjects]);

    useEffect(() => {
        const showModal = (e: CustomEventInit<SubjectRefTree>) => {
            documentRefTree.current = e.detail ?? undefined;
            setVisible(true);
        };
        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.addDocumentRefSubject, showModal);
        return () => {
            window.removeEventListener(CHILD_PARENT_WINDOW_EVENT.addDocumentRefSubject, showModal);
        };
    }, [setVisible]);

    return (
        <Modal
            title={t('Ajouter au sujet')}
            footer={null}
            open={visible}
            onCancel={hide}
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
