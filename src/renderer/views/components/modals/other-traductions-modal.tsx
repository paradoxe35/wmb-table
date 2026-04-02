import { Button, Divider, Empty, Modal, Spin, Tag, Tooltip } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    useDocumentPresentation,
    useModalVisible,
    useActiveTabTitle,
    useOpenDocumentRequest,
} from '@renderer/hooks';
import {
    useDocumentTabsStore,
    useSermonStore,
    selectActiveSermonTab,
    selectActiveTabKey,
} from '@renderer/stores';
import { BookOutlined, EyeOutlined } from '@ant-design/icons';
import {
    CHILD_PARENT_WINDOW_EVENT,
    type OpenOtherTraductionsModalDetail,
} from '@renderer/utils/events';
import { getLanguageDisplayName } from '@shared/tts.types';
import { buildSermonDocumentIdentity, type SermonTranslation } from '@shared/types';

export function OtherTraductionsModal() {
    const { t } = useTranslation();
    const { visible, hide, setVisible } = useModalVisible();
    const activeTab = useDocumentTabsStore(selectActiveSermonTab);
    const sermonsById = useSermonStore((s) => s.sermonsById);
    const title = useActiveTabTitle();
    const { buildOpenRequest } = useDocumentPresentation();
    const openDocumentRequest = useOpenDocumentRequest();
    const switchSermonTabTranslation = useDocumentTabsStore((s) => s.switchSermonTabTranslation);
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);

    const [translations, setTranslations] = useState<SermonTranslation[]>([]);
    const [loading, setLoading] = useState(false);
    const [request, setRequest] = useState<OpenOtherTraductionsModalDetail | null>(null);

    const meta = activeTab?.documentId ? sermonsById[activeTab.documentId] : undefined;
    const sermonId = request?.sermonId ?? meta?.sermonId;
    const modalTitle = request?.title ?? title;
    const availableTraductions = request?.availableTraductions ?? meta?.availableTraductions ?? [];
    const hasWithinLanguage = availableTraductions.length > 1;

    useEffect(() => {
        if (!visible || !sermonId) return;

        setLoading(true);
        window.api.documents
            .getTranslations(sermonId)
            .then(setTranslations)
            .catch(() => setTranslations([]))
            .finally(() => setLoading(false));
    }, [sermonId, visible]);

    useEffect(() => {
        const showModal = (event: Event) => {
            const nextRequest = (event as CustomEvent<OpenOtherTraductionsModalDetail | undefined>)
                .detail;
            setRequest(nextRequest ?? null);
            setVisible(true);
        };
        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.openOtherTraductionsModal, showModal);
        return () => {
            window.removeEventListener(
                CHILD_PARENT_WINDOW_EVENT.openOtherTraductionsModal,
                showModal,
            );
        };
    }, [setVisible]);

    const handleOpen = (translationTitle: string, languageCode: string, translationId: number) => {
        if (sermonId) {
            openDocumentRequest(
                buildOpenRequest(
                    translationTitle,
                    buildSermonDocumentIdentity(sermonId, translationId, languageCode),
                ),
            );
        }
        hide();
    };

    const handleSwitchTraduction = (translationId: number) => {
        if (activeTabKey) {
            switchSermonTabTranslation(activeTabKey, translationId);
        }
        hide();
    };

    return (
        <Modal
            title={
                <div className="mr-2">
                    {t('Traductions du document: {{title}}', { title: modalTitle })}
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
                            {t('Sources de traduction')}
                        </Divider>
                        {availableTraductions.map((tr) => (
                            <div
                                key={tr.translationId}
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
                                        {tr.traductionName ??
                                            `${t('Traduction')} ${tr.translationId}`}
                                        <Tag color="blue" style={{ marginLeft: 8 }}>
                                            ID: {tr.translationId}
                                        </Tag>
                                    </span>
                                </div>
                                <Tooltip title={t('Basculer vers cette traduction')}>
                                    <Button
                                        onClick={() => handleSwitchTraduction(tr.translationId)}
                                        shape="circle"
                                        icon={<EyeOutlined />}
                                    />
                                </Tooltip>
                            </div>
                        ))}
                    </>
                )}

                <Divider titlePlacement="left" plain style={{ margin: '8px 0' }}>
                    {t('Autres langues')}
                </Divider>
                {loading ? (
                    <div className="flex flex-center" style={{ marginTop: '2rem' }}>
                        <Spin />
                    </div>
                ) : translations.length === 0 && !hasWithinLanguage ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t('Aucune autre traduction disponible')}
                    />
                ) : (
                    translations.map((tr, i) => (
                        <div
                            key={`${tr.languageCode}-${tr.title}`}
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
                                        {i + 1}. {tr.title}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 'var(--fs-rel-xl)',
                                            color: 'var(--ant-color-text-secondary)',
                                        }}
                                    >
                                        {t('Langue: {{name}}', {
                                            name: getLanguageDisplayName(tr.languageCode),
                                        })}
                                    </div>
                                </div>
                            </div>
                            <Tooltip title={t('Ouvrir le document')}>
                                <Button
                                    onClick={() => {
                                        handleOpen(tr.title, tr.languageCode, tr.translationId);
                                    }}
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
