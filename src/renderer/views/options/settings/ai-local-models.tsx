import { useEffect, useState } from 'react';
import { Button, Card, message, Progress, Select, Space, Tag, Typography } from 'antd';
import {
    CheckCircleOutlined,
    DownloadOutlined,
    LaptopOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type {
    AiLocalModelInfo,
    AiModelDownloadProgress,
    AiSettings,
    AiSupportedLocalModel,
} from '@shared/ai.types';
import { useAiChatStore } from '@renderer/stores';

const { Text } = Typography;

function ModelRow({
    model,
    downloading,
    downloadPct,
    onSelect,
    onDownload,
}: {
    model: AiSupportedLocalModel;
    downloading: boolean;
    downloadPct: number;
    onSelect: (modelId: string) => void;
    onDownload: (modelId: string) => void;
}) {
    const { t } = useTranslation();

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
                gap: 8,
            }}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: '0.85em' }}>
                    {model.name}{' '}
                    <Text type="secondary" style={{ fontSize: '0.85em' }}>
                        ({model.quantization})
                    </Text>{' '}
                    {model.installed ? (
                        <Tag
                            color="success"
                            icon={<CheckCircleOutlined />}
                            style={{ marginInlineStart: 2 }}
                        >
                            {t('Installé')}
                        </Tag>
                    ) : null}
                </Text>
                <Text type="secondary" style={{ fontSize: '0.75em', display: 'block' }}>
                    {t(model.description)}
                    {!model.installed && model.approximateSizeMb > 0 ? (
                        <>
                            {' — '}
                            {t('~{{size}} Mo', { size: model.approximateSizeMb })}
                        </>
                    ) : null}
                </Text>
            </div>
            {downloading ? (
                <Progress
                    percent={downloadPct}
                    size="small"
                    style={{ width: 100, flexShrink: 0 }}
                />
            ) : model.installed ? (
                <Button size="small" type="link" onClick={() => onSelect(model.id)}>
                    {t('Utiliser')}
                </Button>
            ) : (
                <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => onDownload(model.id)}
                >
                    {t('Télécharger')}
                </Button>
            )}
        </div>
    );
}

export default function AiLocalModels({
    settings,
    models,
    supportedModels,
    onRefresh,
    onUpdate,
}: {
    settings: AiSettings;
    models: AiLocalModelInfo[];
    supportedModels: AiSupportedLocalModel[];
    onRefresh: () => void;
    onUpdate: (partial: Partial<AiSettings>) => void;
}) {
    const { t } = useTranslation();
    const downloadModel = useAiChatStore((s) => s.downloadModel);
    const scanLocalModels = useAiChatStore((s) => s.scanLocalModels);
    const [downloads, setDownloads] = useState<Record<string, number>>({});

    useEffect(() => {
        return window.api.on.aiModelDownloadProgress((event: AiModelDownloadProgress) => {
            if (event.status === 'complete') {
                setDownloads((prev) => {
                    const next = { ...prev };
                    delete next[event.modelId];
                    return next;
                });
                message.success(t('Modèle téléchargé'));
                void scanLocalModels();
            } else if (event.status === 'error') {
                setDownloads((prev) => {
                    const next = { ...prev };
                    delete next[event.modelId];
                    return next;
                });
                message.error(event.error ?? t('Le téléchargement a échoué.'));
            } else {
                setDownloads((prev) => ({ ...prev, [event.modelId]: event.percentage }));
            }
        });
    }, [t, scanLocalModels]);

    function selectModel(modelId: string) {
        onUpdate({
            activeProvider: 'local',
            activeModel: modelId,
            providers: {
                ...settings.providers,
                local: { ...settings.providers.local, enabled: true, model: modelId },
            },
        });
    }

    function handleDownload(modelId: string) {
        setDownloads((prev) => ({ ...prev, [modelId]: 0 }));
        void downloadModel(modelId).catch(() => {
            setDownloads((prev) => {
                const next = { ...prev };
                delete next[modelId];
                return next;
            });
        });
    }

    const modelOptions = models.map((m) => ({
        label: (
            <span>
                {m.name}
                {m.recommended ? (
                    <Tag color="blue" style={{ marginInlineStart: 4 }}>
                        {t('Recommandé')}
                    </Tag>
                ) : null}
            </span>
        ),
        value: m.id,
    }));

    return (
        <Card
            size="small"
            title={
                <span>
                    {t('Modèle local')}{' '}
                    <Tag color="green" icon={<LaptopOutlined />}>
                        {t('Local')}
                    </Tag>
                </span>
            }
            extra={
                <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh}>
                    {t('Actualiser')}
                </Button>
            }
        >
            <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Text type="secondary" style={{ fontSize: '0.8em' }}>
                    {t('Fonctionne sans connexion internet, directement sur votre ordinateur.')}
                </Text>

                {models.length > 0 ? (
                    <Select
                        style={{ width: '100%' }}
                        value={settings.providers.local.model ?? undefined}
                        options={modelOptions}
                        onChange={selectModel}
                        placeholder={t('Choisir un modèle')}
                    />
                ) : null}

                {supportedModels.map((m) => (
                    <ModelRow
                        key={m.id}
                        model={m}
                        downloading={m.id in downloads}
                        downloadPct={downloads[m.id] ?? 0}
                        onSelect={selectModel}
                        onDownload={handleDownload}
                    />
                ))}
            </Space>
        </Card>
    );
}
