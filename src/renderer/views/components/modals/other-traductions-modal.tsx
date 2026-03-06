import { Button, Divider, Modal, Spin, Tag, Tooltip } from 'antd';
import { useEffect, useState } from 'react';
import { useModalVisible, useActiveTabTitle } from '@renderer/hooks';
import { useSermonStore, useAppStore, selectActiveTab, selectActiveTabKey } from '@renderer/stores';
import { BookOutlined, EyeOutlined } from '@ant-design/icons';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';

type Translation = { languageCode: string; title: string; translatorName: string | null };

export function OtherTraductionsModal() {
    const { visible, hide, setVisible } = useModalVisible();
    const activeTab = useSermonStore(selectActiveTab);
    const sermonsById = useSermonStore((s) => s.sermonsById);
    const title = useActiveTabTitle();
    const addTab = useSermonStore((s) => s.addTab);
    const setMainView = useAppStore((s) => s.setMainView);
    const updateTabTranslationId = useSermonStore((s) => s.updateTabTranslationId);
    const activeTabKey = useSermonStore(selectActiveTabKey);

    const [translations, setTranslations] = useState<Translation[]>([]);
    const [loading, setLoading] = useState(false);

    const meta = activeTab?.sermonId ? sermonsById[activeTab.sermonId] : undefined;
    const availableTraductions = meta?.availableTraductions ?? [];
    const hasWithinLanguage = availableTraductions.length > 1;

    useEffect(() => {
        if (!visible || !title || !meta) return;

        setLoading(true);
        window.api.documents
            .getTranslations(meta.sermonId)
            .then(setTranslations)
            .catch(() => setTranslations([]))
            .finally(() => setLoading(false));
    }, [visible, activeTab?.sermonId, sermonsById]);

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

    const handleOpen = (translationTitle: string, languageCode: string) => {
        if (meta) {
            addTab(translationTitle, meta.sermonId, 'sermon', languageCode);
            setMainView('document');
        }
        hide();
    };

    const handleSwitchTraduction = (translationId: number) => {
        if (activeTabKey) {
            updateTabTranslationId(activeTabKey, translationId);
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
                        {availableTraductions.map((t) => (
                            <div
                                key={t.translationId}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 0',
                                    borderBottom: '1px solid var(--ant-color-border)',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <BookOutlined />
                                    <span>
                                        {t.traductionName ?? `Traduction ${t.translationId}`}
                                        <Tag color="blue" style={{ marginLeft: 8 }}>
                                            ID: {t.translationId}
                                        </Tag>
                                    </span>
                                </div>
                                <Tooltip title="Basculer vers cette traduction">
                                    <Button
                                        onClick={() => handleSwitchTraduction(t.translationId)}
                                        shape="circle"
                                        icon={<EyeOutlined />}
                                    />
                                </Tooltip>
                            </div>
                        ))}
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
                    translations.map((t, i) => (
                        <div
                            key={`${t.languageCode}-${t.title}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 0',
                                borderBottom: '1px solid var(--ant-color-border)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <BookOutlined />
                                <div>
                                    <div>
                                        {i + 1}. {t.title}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: '0.85em',
                                            color: 'var(--ant-color-text-secondary)',
                                        }}
                                    >
                                        Langue: {t.languageCode}
                                    </div>
                                </div>
                            </div>
                            <Tooltip title="Ouvrir le document">
                                <Button
                                    onClick={() => handleOpen(t.title, t.languageCode)}
                                    shape="circle"
                                    icon={<EyeOutlined />}
                                />
                            </Tooltip>
                        </div>
                    ))
                )}
            </div>
        </Modal>
    );
}
