import { useCallback, useEffect, useState } from 'react';
import { Button, message, Progress, Select, Space, Tag, Typography } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useAppStore } from '@renderer/stores';
import type { TtsModelInfo } from '@shared/tts.types';
import { Field, providerUpdate, type ProviderConfigProps } from './tts-shared';

const { Text } = Typography;

export default function SherpaConfig({ settings, onUpdate }: ProviderConfigProps) {
    const cfg = settings.providers.sherpa;
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const langCode = activeLanguage?.split('-')[0].toLowerCase() ?? '';
    const [models, setModels] = useState<TtsModelInfo[]>([]);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [downloadPct, setDownloadPct] = useState(0);

    const loadModels = useCallback(() => {
        window.api.tts
            .getProviderModels('sherpa')
            .then(setModels)
            .catch(() => {});
    }, []);

    useEffect(() => {
        loadModels();
    }, [loadModels]);

    useEffect(() => {
        return window.api.on.ttsModelDownloadProgress((p) => {
            if (p.provider !== 'sherpa') return;
            setDownloadPct(p.percentage);
            if (p.status === 'complete') {
                message.success('Modèle installé');
                setDownloading(null);
                setDownloadPct(0);
                loadModels();
            }
            if (p.status === 'error') {
                message.error(`Erreur: ${p.error}`);
                setDownloading(null);
                setDownloadPct(0);
            }
        });
    }, [loadModels]);

    const handleDownload = useCallback((modelName: string) => {
        setDownloading(modelName);
        setDownloadPct(0);
        window.api.tts.downloadModel('sherpa', modelName).catch((err) => {
            message.error(`Erreur: ${err.message}`);
            setDownloading(null);
        });
    }, []);

    const handleDelete = useCallback(
        async (modelName: string) => {
            try {
                await window.api.tts.deleteProviderModel('sherpa', modelName);
                message.success('Modèle supprimé');
                loadModels();
                if (cfg.model === modelName) {
                    onUpdate(providerUpdate(settings, 'sherpa', 'model', undefined));
                }
            } catch (err) {
                message.error(`Erreur: ${(err as Error).message}`);
            }
        },
        [loadModels, cfg.model, settings, onUpdate],
    );

    const installed = models.filter((m) => m.installed);
    const activeLangModel = models.find((m) => m.langCode === langCode);
    const activeLangInstalled = activeLangModel?.installed ?? false;

    // Models not yet installed for the active language
    const needsDownload = activeLangModel && !activeLangInstalled;

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
            {/* Show download prompt only when the active language model is missing */}
            {needsDownload && (
                <Field
                    label={`Modèle ${activeLangModel.langLabel}`}
                    hint={`Voix « ${activeLangModel.voiceName} » — environ 50 Mo.`}
                >
                    <div>
                        {downloading === activeLangModel.modelName ? (
                            <Progress percent={downloadPct} size="small" style={{ width: 200 }} />
                        ) : (
                            <Button
                                size="small"
                                icon={<DownloadOutlined />}
                                onClick={() => handleDownload(activeLangModel.modelName)}
                            >
                                Télécharger
                            </Button>
                        )}
                    </div>
                </Field>
            )}

            {/* Voice selector — only when at least one model is installed */}
            {installed.length > 0 && (
                <Field label="Voix" hint="Chaque langue dispose d'une voix dédiée.">
                    <Select
                        style={{ width: '100%' }}
                        value={cfg.model ?? installed[0].modelName}
                        onChange={(v) => onUpdate(providerUpdate(settings, 'sherpa', 'model', v))}
                        options={installed.map((m) => ({
                            label: `${m.voiceName} (${m.langLabel})`,
                            value: m.modelName,
                        }))}
                    />
                </Field>
            )}

            {/* Manage installed models */}
            {installed.length > 0 && (
                <Field label="Modèles installés">
                    <div>
                        {installed.map((m) => (
                            <div
                                key={m.modelName}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '4px 0',
                                }}
                            >
                                <Text style={{ fontSize: '0.9em' }}>
                                    {m.voiceName}{' '}
                                    <Text type="secondary" style={{ fontSize: '0.85em' }}>
                                        ({m.langLabel})
                                    </Text>
                                </Text>
                                <Space size="small">
                                    <Tag color="green" icon={<CheckCircleOutlined />}>
                                        Installé
                                    </Tag>
                                    <Button
                                        type="text"
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleDelete(m.modelName)}
                                    />
                                </Space>
                            </div>
                        ))}
                    </div>
                </Field>
            )}

            {/* No models at all and no active lang match */}
            {installed.length === 0 && !needsDownload && (
                <Text type="secondary" style={{ fontSize: '0.9em' }}>
                    Aucun modèle disponible pour la langue active.
                </Text>
            )}
        </Space>
    );
}
