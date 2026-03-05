import { Button, List, Modal, Spin, Tooltip } from 'antd';
import { useEffect, useState } from 'react';
import {
    useSermonLookup,
    useModalVisible,
    useActiveTabTitle,
    useOpenDocument,
} from '@renderer/hooks';
import { BookOutlined, EyeOutlined } from '@ant-design/icons';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';

type Translation = { languageCode: string; title: string };

export function OtherTraductionsModal() {
    const { visible, hide, setVisible } = useModalVisible();
    const { sermonsByTitle } = useSermonLookup();
    const title = useActiveTabTitle();
    const viewDocument = useOpenDocument();

    const [translations, setTranslations] = useState<Translation[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible || !title) return;
        const meta = sermonsByTitle[title];
        if (!meta) return;

        setLoading(true);
        (window.api.documents.getTranslations(meta.translationId) as Promise<Translation[]>)
            .then(setTranslations)
            .catch(() => setTranslations([]))
            .finally(() => setLoading(false));
    }, [visible, title, sermonsByTitle]);

    useEffect(() => {
        const showModal = () => setVisible(true);
        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.openOtherTraductionsModal, showModal);
        return () => {
            window.removeEventListener(
                CHILD_PARENT_WINDOW_EVENT.openOtherTraductionsModal,
                showModal,
            );
        };
    }, []);

    const handleOpen = (translationTitle: string) => {
        viewDocument(translationTitle);
        hide();
    };

    return (
        <Modal
            title={
                <div className="mr-2">
                    Autres Traductions du document: <em>{title}</em>
                </div>
            }
            footer={[]}
            open={visible}
            onOk={hide}
            onCancel={hide}
        >
            <div style={{ overflow: 'auto', height: '300px' }}>
                {loading ? (
                    <div className="flex flex-center" style={{ marginTop: '2rem' }}>
                        <Spin />
                    </div>
                ) : (
                    <List
                        itemLayout="horizontal"
                        dataSource={translations}
                        renderItem={(t, i) => (
                            <List.Item
                                actions={[
                                    <Tooltip key="open" title="Ouvrir le document">
                                        <Button
                                            onClick={() => handleOpen(t.title)}
                                            shape="circle"
                                            icon={<EyeOutlined />}
                                        />
                                    </Tooltip>,
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={<BookOutlined />}
                                    description={`Langue: ${t.languageCode}`}
                                    title={i + 1 + '. ' + t.title}
                                />
                            </List.Item>
                        )}
                    />
                )}
            </div>
        </Modal>
    );
}
