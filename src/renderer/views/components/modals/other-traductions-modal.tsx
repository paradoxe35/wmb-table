import { Button, Divider, List, Modal, Spin, Tag, Tooltip } from 'antd';
import { useEffect, useState } from 'react';
import {
    useSermonLookup,
    useModalVisible,
    useActiveTabTitle,
    useOpenDocument,
} from '@renderer/hooks';
import { useSermonStore } from '@renderer/stores';
import { BookOutlined, EyeOutlined } from '@ant-design/icons';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';

type Translation = { languageCode: string; title: string; translatorName: string | null };

export function OtherTraductionsModal() {
    const { visible, hide, setVisible } = useModalVisible();
    const { sermonsByTitle } = useSermonLookup();
    const title = useActiveTabTitle();
    const viewDocument = useOpenDocument();
    const updateTabTranslationId = useSermonStore((s) => s.updateTabTranslationId);

    const [translations, setTranslations] = useState<Translation[]>([]);
    const [loading, setLoading] = useState(false);

    const meta = title ? sermonsByTitle[title] : undefined;
    const availableTraductions = meta?.availableTraductions ?? [];
    const hasWithinLanguage = availableTraductions.length > 1;

    useEffect(() => {
        if (!visible || !title || !meta) return;

        setLoading(true);
        window.api.documents
            .getTranslations(meta.sermonDate)
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

    const handleSwitchTraduction = (translationId: number) => {
        if (title) {
            updateTabTranslationId(title, translationId);
        }
        hide();
    };

    return (
        <Modal
            title={
                <div className="mr-2">
                    Traductions du document: <em>{title}</em>
                </div>
            }
            footer={[]}
            open={visible}
            onOk={hide}
            onCancel={hide}
        >
            <div style={{ overflow: 'auto', maxHeight: '400px' }}>
                {hasWithinLanguage && (
                    <>
                        <Divider titlePlacement="left" plain style={{ margin: '8px 0' }}>
                            Sources de traduction
                        </Divider>
                        <List
                            itemLayout="horizontal"
                            dataSource={availableTraductions}
                            renderItem={(t) => (
                                <List.Item
                                    actions={[
                                        <Tooltip
                                            key="switch"
                                            title="Basculer vers cette traduction"
                                        >
                                            <Button
                                                onClick={() =>
                                                    handleSwitchTraduction(t.translationId)
                                                }
                                                shape="circle"
                                                icon={<EyeOutlined />}
                                            />
                                        </Tooltip>,
                                    ]}
                                >
                                    <List.Item.Meta
                                        avatar={<BookOutlined />}
                                        title={
                                            <span>
                                                {t.traductionName ??
                                                    `Traduction ${t.translationId}`}
                                                <Tag color="blue" style={{ marginLeft: 8 }}>
                                                    ID: {t.translationId}
                                                </Tag>
                                            </span>
                                        }
                                    />
                                </List.Item>
                            )}
                        />
                    </>
                )}

                <Divider titlePlacement="left" plain style={{ margin: '8px 0' }}>
                    Autres langues
                </Divider>
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
