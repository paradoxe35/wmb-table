import { Divider, Input, Modal, Space, message } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SubjectDocument, SubjectRefTree } from '@shared/types';
import { useModalVisible, useActiveTabTitle, useValueStateRef } from '@renderer/hooks';
import { BookOutlined } from '@ant-design/icons';
import { CHILD_PARENT_WINDOW_EVENT, SUBJECT_EVENT } from '@renderer/utils/events';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';
import { useSermonStore, useSubjectsStore, selectActiveTab } from '@renderer/stores';

export function SubjectSelectModal() {
    const title = useActiveTabTitle();
    const titleRef = useValueStateRef(title);
    const activeTab = useSermonStore(selectActiveTab);

    const setPendingNavigation = useSermonStore((s) => s.setPendingNavigation);

    const documentRefTree = useRef<SubjectRefTree | undefined>(undefined);

    const { visible, hide, setVisible } = useModalVisible();

    const [datas, setDatas] = useState<SubjectDocument[]>([]);
    const subjects = useSubjectsStore((s) => s.subjects);

    const onSelectItem = (name: string) => {
        if (!documentRefTree.current) return;

        const subject = subjects.find((s) => s.name === name);
        if (!subject) return;

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
                activeTab?.sermonId,
            )
            .then((item) => {
                setPendingNavigation({
                    documentTitle: item.documentTitle,
                    documentHtmlTree: item.documentHtmlTree,
                });
                window.dispatchEvent(
                    new CustomEvent(SUBJECT_EVENT.focusSubject, { detail: { name } }),
                );
                message.success('Ajouté au sujet');
            })
            .catch(() => {
                message.error("Erreur lors de l'ajout au sujet");
            });
        setVisible(false);
    };

    const onSearch = useCallback(
        (value: string) => {
            if (subjects.length) {
                setDatas(subjects.filter((d) => simpleRegExp(value).test(strNormalize(d.name))));
            }
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
    }, []);
    return (
        <Modal
            title={
                <Space orientation="horizontal">
                    <span>Choiser un sujet</span>
                    <Search onSearch={onSearch} />
                </Space>
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
    onSelectItem: (name: string) => void;
    datas: SubjectDocument[];
}) {
    return (
        <>
            {datas.map((item) => (
                <ItemSubject key={item.name} item={item} onSelectItem={onSelectItem} />
            ))}
        </>
    );
}

const ItemSubject: React.FC<{
    item: SubjectDocument;
    onSelectItem: (name: string) => void;
    children?: React.ReactNode;
}> = ({ item, onSelectItem }) => {
    return (
        <>
            <span
                className={`smart-editable big`}
                onClick={() => onSelectItem(item.name)}
                title={item.name}
            >
                <div className="o-icon">
                    <BookOutlined />
                </div>
                <b>{item.name}</b>
            </span>
            <Divider style={{ margin: '7px 0' }} />
        </>
    );
};

function Search({ onSearch }: { onSearch: (value: string) => void }) {
    return (
        <Space orientation="horizontal">
            <Input.Search placeholder="Recherche" allowClear onSearch={onSearch} />
        </Space>
    );
}
