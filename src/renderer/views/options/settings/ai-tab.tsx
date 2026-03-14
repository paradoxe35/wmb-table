import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Divider, Select, Space, Switch, Tag, Typography } from 'antd';
import { BookOutlined, CloudOutlined, LaptopOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { AiBuiltinProviderId, AiCustomProviderConfig } from '@shared/ai.types';
import { useAiChatStore, useAppStore } from '@renderer/stores';
import { buildDocsGuideLink } from '@renderer/utils/constants';
import { Field, Hint } from './ai-shared';
import { BuiltinProviderConfig, CustomProviderConfig } from './ai-provider-config';
import AiCustomProviderModal from './ai-custom-provider';
import AiLocalModels from './ai-local-models';

const { Text } = Typography;

export default function AiTab() {
    const { t } = useTranslation();
    const initialize = useAiChatStore((s) => s.initialize);
    const settings = useAiChatStore((s) => s.settings);
    const providerCatalog = useAiChatStore((s) => s.providerCatalog);
    const localModels = useAiChatStore((s) => s.localModels);
    const saveSettings = useAiChatStore((s) => s.saveSettings);
    const scanLocalModels = useAiChatStore((s) => s.scanLocalModels);
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const [customModalOpen, setCustomModalOpen] = useState(false);

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

    const activeCustomProvider = useMemo(
        () => settings?.customProviders.find((p) => p.id === settings?.activeProvider),
        [settings?.customProviders, settings?.activeProvider],
    );

    if (!settings) {
        return null;
    }

    function handleProviderChange(value: string) {
        const customProv = settings!.customProviders.find((p) => p.id === value);
        const builtinConfig = settings!.providers[value as AiBuiltinProviderId];
        const activeModel = customProv?.defaultModel ?? builtinConfig?.model ?? null;
        void saveSettings({ activeProvider: value, activeModel });
    }

    function handleAddCustomProvider(provider: AiCustomProviderConfig) {
        void saveSettings({
            customProviders: [...settings!.customProviders, provider],
            activeProvider: provider.id,
            activeModel: provider.defaultModel ?? null,
        });
    }

    function openDocs() {
        const url = buildDocsGuideLink('settings-assistant', activeLanguage);
        void window.api.app.openExternal(url);
    }

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            {/* Enable toggle */}
            <Card
                size="small"
                title={t('Assistant')}
                extra={
                    <Button
                        type="text"
                        size="small"
                        icon={<BookOutlined />}
                        onClick={openDocs}
                        style={{ fontSize: '0.78em', paddingInline: 6 }}
                    >
                        {t('Documentation')}
                    </Button>
                }
            >
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
                        dropdownRender={(menu) => (
                            <>
                                {menu}
                                <Divider style={{ margin: '4px 0' }} />
                                <Button
                                    type="text"
                                    icon={<PlusOutlined />}
                                    style={{ width: '100%', textAlign: 'start' }}
                                    onClick={() => setCustomModalOpen(true)}
                                >
                                    {t('Ajouter un fournisseur personnalisé')}
                                </Button>
                            </>
                        )}
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

            {/* Local models */}
            {settings.activeProvider === 'local' ? (
                <AiLocalModels
                    settings={settings}
                    models={localModels?.models ?? []}
                    supportedModels={localModels?.supportedModels ?? []}
                    onRefresh={() => void scanLocalModels()}
                    onUpdate={(p) => void saveSettings(p)}
                />
            ) : null}

            {/* Active provider config: custom */}
            {activeCustomProvider ? (
                <CustomProviderConfig
                    provider={activeCustomProvider}
                    settings={settings}
                    onSave={(p) => void saveSettings(p)}
                />
            ) : null}

            {/* Language behavior */}
            <Card size="small">
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

            {/* Custom provider modal */}
            <AiCustomProviderModal
                open={customModalOpen}
                onClose={() => setCustomModalOpen(false)}
                onAdd={handleAddCustomProvider}
            />
        </Space>
    );
}
