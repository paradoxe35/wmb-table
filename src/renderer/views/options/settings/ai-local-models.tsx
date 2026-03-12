import { Button, Card, Select, Space, Tag, Typography } from 'antd';
import {
    CheckCircleOutlined,
    DownloadOutlined,
    LaptopOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { AiLocalModelInfo, AiSettings, AiSupportedLocalModel } from '@shared/ai.types';

const { Text } = Typography;

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
                    <div
                        key={m.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 0',
                        }}
                    >
                        <div>
                            <Text style={{ fontSize: '0.85em' }}>
                                {m.name}{' '}
                                {m.installed ? (
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
                                {t(m.description)}
                            </Text>
                        </div>
                        {m.installed ? (
                            <Button size="small" type="link" onClick={() => selectModel(m.id)}>
                                {t('Utiliser')}
                            </Button>
                        ) : (
                            <Button
                                size="small"
                                type="link"
                                icon={<DownloadOutlined />}
                                href={m.downloadUrl}
                                target="_blank"
                            >
                                {t('Télécharger')}
                            </Button>
                        )}
                    </div>
                ))}
            </Space>
        </Card>
    );
}
