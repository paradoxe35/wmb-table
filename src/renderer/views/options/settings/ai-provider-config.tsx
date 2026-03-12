import { useState } from 'react';
import { Button, Card, Divider, Input, Popconfirm, Space, Tag } from 'antd';
import {
    CheckCircleOutlined,
    CloudOutlined,
    CloseCircleOutlined,
    DeleteOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type {
    AiBuiltinProviderId,
    AiCustomProviderConfig,
    AiProviderDefinition,
    AiSettings,
} from '@shared/ai.types';
import { useAiChatStore } from '@renderer/stores';
import { Field, Hint } from './ai-shared';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

function TestButton({
    providerId,
    model,
    apiKey,
    baseUrl,
}: {
    providerId: string;
    model: string | null | undefined;
    apiKey?: string;
    baseUrl?: string;
}) {
    const { t } = useTranslation();
    const testProvider = useAiChatStore((s) => s.testProvider);
    const [status, setStatus] = useState<TestStatus>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    async function handleTest() {
        if (!model) {
            return;
        }
        setStatus('testing');
        setErrorMessage('');
        try {
            const result = await testProvider({
                providerId,
                model,
                apiKey,
                baseUrl,
            });
            setStatus(result.valid ? 'success' : 'error');
            if (result.error) {
                setErrorMessage(result.error);
            }
        } catch {
            setStatus('error');
            setErrorMessage(t('La connexion a échoué.'));
        }
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
                size="small"
                onClick={handleTest}
                disabled={!model || status === 'testing'}
                loading={status === 'testing'}
            >
                {t('Tester la connexion')}
            </Button>
            {status === 'success' ? (
                <Tag icon={<CheckCircleOutlined />} color="success">
                    {t('Connecté')}
                </Tag>
            ) : null}
            {status === 'error' ? (
                <Tag icon={<CloseCircleOutlined />} color="error">
                    {errorMessage || t('Échec')}
                </Tag>
            ) : null}
        </div>
    );
}

export function BuiltinProviderConfig({
    provider,
    settings,
    onSave,
}: {
    provider: AiProviderDefinition;
    settings: AiSettings;
    onSave: (partial: Partial<AiSettings>) => void;
}) {
    const { t } = useTranslation();
    const config = settings.providers[provider.id as AiBuiltinProviderId];

    function updateField(key: string, value: string) {
        onSave({
            providers: {
                ...settings.providers,
                [provider.id]: { ...config, [key]: value },
            },
        });
    }

    return (
        <Card
            size="small"
            title={
                <span>
                    {provider.name}{' '}
                    <Tag color="blue" icon={<CloudOutlined />}>
                        {t('Cloud')}
                    </Tag>
                </span>
            }
        >
            <Hint>{t(provider.description)}</Hint>
            <Divider style={{ margin: '8px 0' }} />
            <Space direction="vertical" style={{ width: '100%' }} size="small">
                {provider.configurableFields.map((field) => {
                    if (field.key === 'apiKey') {
                        return (
                            <Field key={field.key} label={t('Clé API')}>
                                <Input.Password
                                    value={config?.apiKey ?? ''}
                                    onChange={(e) => updateField('apiKey', e.target.value)}
                                    placeholder={t('Clé API')}
                                />
                            </Field>
                        );
                    }
                    if (field.key === 'baseUrl') {
                        return (
                            <Field key={field.key} label={t('URL de base')}>
                                <Input
                                    value={config?.baseUrl ?? ''}
                                    onChange={(e) => updateField('baseUrl', e.target.value)}
                                    placeholder="https://..."
                                />
                            </Field>
                        );
                    }
                    return (
                        <Field
                            key={field.key}
                            label={t('Modèle')}
                            hint={t(
                                "Utilisez l'identifiant exact du modèle fourni par ce service.",
                            )}
                        >
                            <Input
                                value={config?.model ?? ''}
                                onChange={(e) => updateField('model', e.target.value)}
                                placeholder={t('Modèle')}
                            />
                        </Field>
                    );
                })}
                <TestButton
                    providerId={provider.id}
                    model={config?.model}
                    apiKey={config?.apiKey}
                    baseUrl={config?.baseUrl}
                />
            </Space>
        </Card>
    );
}

export function CustomProviderConfig({
    provider,
    settings,
    onSave,
}: {
    provider: AiCustomProviderConfig;
    settings: AiSettings;
    onSave: (partial: Partial<AiSettings>) => void;
}) {
    const { t } = useTranslation();

    function updateCustom(partial: Partial<AiCustomProviderConfig>) {
        onSave({
            customProviders: settings.customProviders.map((p) =>
                p.id === provider.id ? { ...p, ...partial } : p,
            ),
        });
    }

    function deleteCustom() {
        onSave({
            customProviders: settings.customProviders.filter((p) => p.id !== provider.id),
            activeProvider: null,
            activeModel: null,
        });
    }

    return (
        <Card
            size="small"
            title={
                <span>
                    {provider.name} <Tag style={{ marginInlineStart: 4 }}>{t('Personnalisé')}</Tag>
                </span>
            }
            extra={
                <Popconfirm title={t('Supprimer ce fournisseur ?')} onConfirm={deleteCustom}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
            }
        >
            <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Field label={t('URL de base')}>
                    <Input
                        value={provider.baseUrl}
                        onChange={(e) => updateCustom({ baseUrl: e.target.value })}
                        placeholder="http://127.0.0.1:1234/v1"
                    />
                </Field>
                <Field label={t('Clé API')}>
                    <Input.Password
                        value={provider.apiKey ?? ''}
                        onChange={(e) => updateCustom({ apiKey: e.target.value })}
                        placeholder={t('Optionnel')}
                    />
                </Field>
                <Field label={t('Modèle par défaut')}>
                    <Input
                        value={provider.defaultModel ?? ''}
                        onChange={(e) => updateCustom({ defaultModel: e.target.value })}
                    />
                </Field>
                <TestButton
                    providerId={provider.id}
                    model={provider.defaultModel}
                    apiKey={provider.apiKey}
                    baseUrl={provider.baseUrl}
                />
            </Space>
        </Card>
    );
}
