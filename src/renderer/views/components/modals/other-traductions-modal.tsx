import { Button, Divider, Empty, Modal, Spin, Tag, Tooltip } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useModalVisible, useOpenDocumentRequest } from '@renderer/hooks';
import { useDocumentTabsStore } from '@renderer/stores';
import { BookOutlined, EyeOutlined } from '@ant-design/icons';
import {
    CHILD_PARENT_WINDOW_EVENT,
    type OpenOtherTraductionsModalDetail,
} from '@renderer/utils/events';
import { getLanguageDisplayName } from '@shared/tts.types';
import {
    buildSermonDocumentIdentity,
    type AvailableTraduction,
    type SermonTranslation,
} from '@shared/types';

export function OtherTraductionsModal() {
    const { t } = useTranslation();
    const { visible, hide, setVisible } = useModalVisible();
    const openDocumentRequest = useOpenDocumentRequest();
    const updateSermonTab = useDocumentTabsStore((s) => s.updateSermonTab);

    const [translations, setTranslations] = useState<SermonTranslation[]>([]);
    const [loading, setLoading] = useState(false);
    const [request, setRequest] = useState<OpenOtherTraductionsModalDetail | null>(null);

    const sermonId = request?.sermonId ?? null;
    const modalTitle = request?.title ?? '';
    const availableTraductions = request?.availableTraductions ?? [];
    const hasWithinLanguage = availableTraductions.length > 1;

    const currentLanguageCodes = useMemo(
        () => new Set(availableTraductions.map((translation) => translation.languageCode)),
        [availableTraductions],
    );

    const otherLanguageTranslations = useMemo(() => {
        return translations.filter(
            (translation) => !currentLanguageCodes.has(translation.languageCode),
        );
    }, [currentLanguageCodes, translations]);

    const hideModal = useCallback(() => {
        setRequest(null);
        hide();
    }, [hide]);

    useEffect(() => {
        if (!visible || !sermonId) {
            return;
        }

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
            openDocumentRequest({
                title: translationTitle,
                ...buildSermonDocumentIdentity(sermonId, translationId, languageCode),
            });
        }
        hideModal();
    };

    const handleSwitchTraduction = (traduction: AvailableTraduction) => {
        if (request) {
            updateSermonTab(request.tabKey, {
                title: traduction.title,
                documentId: request.sermonId,
                translationId: traduction.translationId,
                languageCode: traduction.languageCode,
            });
        }
        hideModal();
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
            onOk={hideModal}
            onCancel={hideModal}
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
                                        onClick={() => handleSwitchTraduction(tr)}
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
                ) : otherLanguageTranslations.length === 0 && !hasWithinLanguage ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t('Aucune autre traduction disponible')}
                    />
                ) : (
                    otherLanguageTranslations.map((tr, i) => (
                        <div
                            key={`${tr.languageCode}:${tr.translationId}`}
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
