import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Divider, Select, Space, Tag } from 'antd';
import { BookOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
    BUILTIN_PROVIDER_IDS,
    BUILTIN_PROVIDER_REQUIRES_API_KEY,
    isBuiltinProviderId,
    resolveProviderApiKey,
    resolveProviderBaseUrl,
    type AiCustomProviderConfig,
    type AiSettings,
} from '@shared/ai.types';
import { isLocalBaseUrl } from '@shared/ai-provider-input';
import { useAiChatStore, useAppStore } from '@renderer/stores';
import { buildDocsGuideLink } from '@renderer/utils/constants';
import { Field } from './ai-shared';
import { BuiltinProviderConfig, CustomProviderConfig } from './ai-provider-config';
import AiCustomProviderModal from './ai-custom-provider';
import InlineHelpPopover from '../components/inline-help-popover';
import { getAiSettingsHelp } from '../components/option-help-content';
import { LocalityTag } from './tts-shared';
import { useSaveAiSettings } from './use-save-ai-settings';
import McpServerSettings from './mcp-server-settings';

function missingSetupWarning(settings: AiSettings): string | null {
    const providerId = settings.activeProvider;
    if (!providerId) return "Choisissez un fournisseur pour utiliser l'assistant.";
    const needsApiKey =
        isBuiltinProviderId(providerId) && BUILTIN_PROVIDER_REQUIRES_API_KEY[providerId];
    if (needsApiKey && !resolveProviderApiKey(settings, providerId)) {
        return 'Ajoutez une clé API pour utiliser ce fournisseur.';
    }
    return null;
}

export default function AiTab() {
    const { t } = useTranslation();
    const initialize = useAiChatStore((s) => s.initialize);
    const settings = useAiChatStore((s) => s.settings);
    const providerCatalog = useAiChatStore((s) => s.providerCatalog);
    const saveSettings = useSaveAiSettings();
    const contentLanguage = useAppStore((s) => s.contentLanguage);
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
                    <LocalityTag
                        type={
                            isLocalBaseUrl(resolveProviderBaseUrl(settings, p.id))
                                ? 'local'
                                : 'remote'
                        }
                    />
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

    const setupWarning = missingSetupWarning(settings);

    function handleProviderChange(value: string) {
        saveSettings({ activeProvider: value });
    }

    function handleAddCustomProvider(provider: AiCustomProviderConfig) {
        saveSettings((current) => ({
            customProviders: [...current.customProviders, provider],
            activeProvider: provider.id,
        }));
    }

    function openCustomModal() {
        setCustomModalOpen(true);
    }

    function openDocs() {
        const url = buildDocsGuideLink('settings-assistant', contentLanguage);
        void window.api.app.openExternal(url);
    }

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            <Card
                size="small"
                title={
                    <Space size={6}>
                        <span>{t('Assistant')}</span>
                        <InlineHelpPopover content={getAiSettingsHelp(t)} />
                    </Space>
                }
                extra={
                    <Button
                        type="text"
                        size="small"
                        className="settings-doc-button"
                        icon={<BookOutlined />}
                        onClick={openDocs}
                        style={{ fontSize: 'var(--fs-rel-base)' }}
                    >
                        {t('Documentation')}
                    </Button>
                }
            >
                <Field
                    label={t('Fournisseur actif')}
                    htmlFor="ai-active-provider"
                    hint={t('Choisissez le service à utiliser pour le chat IA.')}
                >
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Select
                            id="ai-active-provider"
                            style={{ flex: '1 1 220px', minWidth: 0 }}
                            value={settings.activeProvider}
                            options={providerOptions}
                            onChange={handleProviderChange}
                            placeholder={t('Choisir un fournisseur')}
                            popupRender={(menu) => (
                                <>
                                    {menu}
                                    <Divider style={{ margin: '4px 0' }} />
                                    <Button
                                        type="text"
                                        icon={<PlusOutlined />}
                                        style={{ width: '100%', textAlign: 'start' }}
                                        onClick={openCustomModal}
                                    >
                                        {t('Ajouter un fournisseur personnalisé')}
                                    </Button>
                                </>
                            )}
                        />
                        <Button icon={<PlusOutlined />} onClick={openCustomModal}>
                            {t('Ajouter un fournisseur')}
                        </Button>
                    </div>
                </Field>
                {setupWarning ? (
                    <Alert
                        type="warning"
                        showIcon
                        style={{ marginTop: 8 }}
                        title={t(setupWarning)}
                    />
                ) : null}
            </Card>

            {activeBuiltinProvider ? (
                <BuiltinProviderConfig
                    provider={activeBuiltinProvider}
                    settings={settings}
                    onSave={saveSettings}
                />
            ) : null}

            {activeCustomProvider ? (
                <CustomProviderConfig
                    provider={activeCustomProvider}
                    settings={settings}
                    onSave={saveSettings}
                />
            ) : null}

            {/* Language behavior */}
            <Card size="small">
                <Field
                    label={t('Comportement des langues')}
                    htmlFor="ai-language-preference"
                    hint={t(
                        "L'assistant suit la langue active, sauf si vous demandez explicitement une autre langue.",
                    )}
                >
                    <Select
                        id="ai-language-preference"
                        style={{ width: '100%' }}
                        value={settings.languagePreference}
                        options={[
                            { label: t('Suivre la langue active'), value: 'active' },
                            { label: t('Changer uniquement sur demande'), value: 'explicit-only' },
                        ]}
                        onChange={(languagePreference) => saveSettings({ languagePreference })}
                    />
                </Field>
            </Card>

            <McpServerSettings />

            <AiCustomProviderModal
                open={customModalOpen}
                onClose={() => setCustomModalOpen(false)}
                onAdd={handleAddCustomProvider}
                takenIds={[...BUILTIN_PROVIDER_IDS, ...settings.customProviders.map((p) => p.id)]}
                takenNames={[
                    ...providerCatalog.map((p) => p.name),
                    ...settings.customProviders.map((p) => p.name),
                ]}
            />
        </Space>
    );
}
