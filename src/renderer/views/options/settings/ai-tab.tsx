import { useEffect, useMemo } from 'react';
import {
    Button,
    Card,
    Divider,
    Empty,
    Input,
    Popconfirm,
    Select,
    Space,
    Switch,
    Tag,
    Typography,
} from 'antd';
import { CloudOutlined, DeleteOutlined, LaptopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type {
    AiBuiltinProviderId,
    AiCustomProviderConfig,
    AiProviderDefinition,
    AiSettings,
} from '@shared/ai.types';
import { useAiChatStore } from '@renderer/stores';
import AiCustomProviderForm from './ai-custom-provider';
import AiLocalModels from './ai-local-models';

const { Text } = Typography;

function Hint({ children }: { children: string }) {
    return (
        <Text type="secondary" style={{ fontSize: '0.8em', display: 'block', marginTop: 2 }}>
            {children}
        </Text>
    );
}

function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <Text strong style={{ fontSize: '0.9em' }}>
                {label}
            </Text>
            {hint ? <Hint>{hint}</Hint> : null}
            <div style={{ marginTop: 4 }}>{children}</div>
        </div>
    );
}

function BuiltinProviderConfig({
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
            </Space>
        </Card>
    );
}

function CustomProviderCard({
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
            ...(settings.activeProvider === provider.id ? { activeProvider: null } : {}),
        });
    }

    return (
        <Card
            size="small"
            title={provider.name}
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
            </Space>
        </Card>
    );
}

export default function AiTab() {
    const { t } = useTranslation();
    const initialize = useAiChatStore((s) => s.initialize);
    const settings = useAiChatStore((s) => s.settings);
    const providerCatalog = useAiChatStore((s) => s.providerCatalog);
    const localModels = useAiChatStore((s) => s.localModels);
    const saveSettings = useAiChatStore((s) => s.saveSettings);
    const scanLocalModels = useAiChatStore((s) => s.scanLocalModels);

    useEffect(() => {
        void initialize();
    }, [initialize]);

    const providerOptions = useMemo(() => {
        if (!settings) {
            return [];
        }
        const builtIn = providerCatalog.map((p) => ({
            label: (
                <span>
                    {p.name}{' '}
                    {p.kind === 'local' ? (
                        <Tag
                            color="green"
                            icon={<LaptopOutlined />}
                            style={{ marginInlineStart: 4 }}
                        >
                            {t('Local')}
                        </Tag>
                    ) : (
                        <Tag color="blue" icon={<CloudOutlined />} style={{ marginInlineStart: 4 }}>
                            {t('Cloud')}
                        </Tag>
                    )}
                </span>
            ),
            value: p.id,
        }));
        const custom = settings.customProviders.map((p) => ({
            label: (
                <span>
                    {p.name} <Tag style={{ marginInlineStart: 4 }}>{t('Personnalisé')}</Tag>
                </span>
            ),
            value: p.id,
        }));
        return [...builtIn, ...custom];
    }, [providerCatalog, settings, t]);

    const activeBuiltinProvider = useMemo(
        () => providerCatalog.find((p) => p.id === settings?.activeProvider),
        [providerCatalog, settings?.activeProvider],
    );

    if (!settings) {
        return null;
    }

    function handleProviderChange(activeProvider: string) {
        const customProv = settings!.customProviders.find((p) => p.id === activeProvider);
        const builtinConfig = settings!.providers[activeProvider as AiBuiltinProviderId];
        const activeModel = customProv?.defaultModel ?? builtinConfig?.model ?? null;
        void saveSettings({ activeProvider, activeModel });
    }

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* Enable toggle */}
            <Card size="small">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Switch
                        checked={settings.enabled}
                        onChange={(enabled) => void saveSettings({ enabled })}
                    />
                    <div>
                        <Text style={{ fontSize: '0.9em' }}>{t("Activer l'assistant IA")}</Text>
                        <Hint>
                            {t("Une fois activé, l'assistant apparaît dans la barre latérale.")}
                        </Hint>
                    </div>
                </div>
            </Card>

            {/* Provider selector */}
            <Card size="small">
                <Field
                    label={t('Fournisseur actif')}
                    hint={t('Choisissez le service à utiliser pour le chat IA.')}
                >
                    <Select
                        style={{ width: '100%' }}
                        value={settings.activeProvider}
                        options={providerOptions}
                        onChange={handleProviderChange}
                        placeholder={t('Choisir un fournisseur')}
                    />
                </Field>

                <Divider style={{ margin: '8px 0' }} />

                <Field
                    label={t('Comportement des langues')}
                    hint={t(
                        "L'assistant suit la langue active, sauf si vous demandez explicitement une autre langue.",
                    )}
                >
                    <Select
                        style={{ width: '100%' }}
                        value={settings.languagePreference}
                        options={[
                            { label: t('Suivre la langue active'), value: 'active' },
                            { label: t('Changer uniquement sur demande'), value: 'explicit-only' },
                        ]}
                        onChange={(languagePreference) => void saveSettings({ languagePreference })}
                    />
                </Field>
            </Card>

            {/* Active provider config: builtin cloud */}
            {activeBuiltinProvider && activeBuiltinProvider.id !== 'local' ? (
                <BuiltinProviderConfig
                    provider={activeBuiltinProvider}
                    settings={settings}
                    onSave={(p) => void saveSettings(p)}
                />
            ) : null}

            {/* Local models — shown when local provider is active */}
            {settings.activeProvider === 'local' ? (
                <AiLocalModels
                    settings={settings}
                    models={localModels?.models ?? []}
                    supportedModels={localModels?.supportedModels ?? []}
                    onRefresh={() => void scanLocalModels()}
                    onUpdate={(p) => void saveSettings(p)}
                />
            ) : null}

            {/* Custom providers management */}
            <Card
                size="small"
                title={t('Fournisseurs personnalisés')}
                extra={
                    <AiCustomProviderForm
                        onAdd={(provider) =>
                            void saveSettings({
                                customProviders: [...settings.customProviders, provider],
                            })
                        }
                    />
                }
            >
                <Hint>{t('Ajoutez un service compatible OpenAI API.')}</Hint>
                {settings.customProviders.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t('Aucun fournisseur personnalisé.')}
                        style={{ margin: '12px 0 0' }}
                    />
                ) : (
                    <Space
                        direction="vertical"
                        style={{ width: '100%', marginTop: 12 }}
                        size="small"
                    >
                        {settings.customProviders.map((provider) => (
                            <CustomProviderCard
                                key={provider.id}
                                provider={provider}
                                settings={settings}
                                onSave={(p) => void saveSettings(p)}
                            />
                        ))}
                    </Space>
                )}
            </Card>
        </Space>
    );
}
