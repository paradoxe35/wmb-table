import { Button, Card, Divider, Popconfirm, Space, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
    resolveActiveModel,
    DEFAULT_MODELS,
    DEFAULT_PROVIDER_BASE_URLS,
    BUILTIN_PROVIDER_REQUIRES_API_KEY,
    type AiBuiltinProviderId,
    type AiCustomProviderConfig,
    type AiProviderConfig,
    type AiProviderDefinition,
    type AiSettings,
} from '@shared/ai.types';
import { isLocalBaseUrl, normalizeApiKey, normalizeBaseUrl } from '@shared/ai-provider-input';
import type { AiSettingsUpdate } from '@renderer/stores/ai-settings-save-queue';
import DebouncedInput from '@renderer/components/debounced-input';
import { ApiKeyLink, describeBaseUrlProblem, Field, Hint } from './ai-shared';
import { ModelSelect } from './ai-model-select';
import { ProviderTestButton } from './ai-provider-test-button';
import { LocalityTag } from './tts-shared';

function defaultModelHint(t: TFunction, defaultModel?: string | null): string | undefined {
    return defaultModel ? `${t('Modèle par défaut')}: ${defaultModel}` : undefined;
}

function defaultBaseUrlHint(t: TFunction, defaultBaseUrl?: string): string | undefined {
    return defaultBaseUrl ? `${t('URL par défaut')}: ${defaultBaseUrl}` : undefined;
}

function baseUrlError(
    t: TFunction,
    value: string,
    options: { required: boolean },
): string | undefined {
    if (!options.required && !value.trim()) return undefined;
    const check = normalizeBaseUrl(value);
    return check.ok ? undefined : describeBaseUrlProblem(t, check.problem);
}

function cleanBaseUrl(value: string, defaultPath?: string): string {
    const check = normalizeBaseUrl(value, { defaultPath });
    return check.ok ? check.url : value.trim();
}

const trimValue = (value: string) => value.trim();

function fieldId(providerId: string, field: string): string {
    return `ai-${providerId}-${field}`;
}

export function BuiltinProviderConfig({
    provider,
    settings,
    onSave,
}: {
    provider: AiProviderDefinition;
    settings: AiSettings;
    onSave: (update: AiSettingsUpdate) => void;
}) {
    const { t } = useTranslation();
    const providerId: AiBuiltinProviderId = provider.id;
    const config = settings.providers[providerId];
    const defaultBaseUrl = DEFAULT_PROVIDER_BASE_URLS[providerId];
    const baseUrl = config?.baseUrl ?? defaultBaseUrl;
    const defaultPath = new URL(defaultBaseUrl).pathname;
    const activeModel = resolveActiveModel(settings);
    const requiresApiKey = BUILTIN_PROVIDER_REQUIRES_API_KEY[providerId] ?? true;

    function updateConfig(patch: Partial<AiProviderConfig>) {
        onSave((current) => ({
            providers: {
                ...current.providers,
                [providerId]: { ...current.providers[providerId], ...patch },
            },
        }));
    }

    function saveBaseUrl(value: string) {
        updateConfig({ baseUrl: cleanBaseUrl(value, defaultPath) || undefined });
    }

    return (
        <Card
            size="small"
            title={
                <span>
                    {provider.name}{' '}
                    <LocalityTag type={isLocalBaseUrl(baseUrl) ? 'local' : 'remote'} />
                </span>
            }
        >
            <Hint>{t(provider.description)}</Hint>
            <Divider style={{ margin: '8px 0' }} />
            <Space orientation="vertical" style={{ width: '100%' }} size="small">
                {provider.configurableFields.map((field) => {
                    const id = fieldId(providerId, field.key);
                    if (field.key === 'apiKey') {
                        return (
                            <Field key={field.key} label={t('Clé API')} htmlFor={id}>
                                <DebouncedInput
                                    id={id}
                                    password
                                    value={config?.apiKey ?? ''}
                                    onChange={(val) =>
                                        updateConfig({ apiKey: normalizeApiKey(val) })
                                    }
                                    normalize={trimValue}
                                    placeholder={requiresApiKey ? t('Clé API') : t('Optionnel')}
                                />
                                <ApiKeyLink provider={provider} />
                            </Field>
                        );
                    }
                    if (field.key === 'baseUrl') {
                        return (
                            <Field
                                key={field.key}
                                label={t('URL de base')}
                                htmlFor={id}
                                hint={defaultBaseUrlHint(t, defaultBaseUrl)}
                            >
                                <DebouncedInput
                                    id={id}
                                    value={config?.baseUrl ?? ''}
                                    onChange={saveBaseUrl}
                                    validate={(val) => baseUrlError(t, val, { required: false })}
                                    normalize={(val) => cleanBaseUrl(val, defaultPath)}
                                    placeholder={defaultBaseUrl ?? 'https://...'}
                                />
                            </Field>
                        );
                    }
                    return (
                        <Field
                            key={field.key}
                            label={t('Modèle')}
                            htmlFor={id}
                            hint={defaultModelHint(t, DEFAULT_MODELS[providerId])}
                        >
                            <ModelSelect
                                id={id}
                                providerId={providerId}
                                value={config?.model ?? ''}
                                defaultModel={DEFAULT_MODELS[providerId]}
                                apiKey={config?.apiKey}
                                baseUrl={baseUrl}
                                onChange={(model) => updateConfig({ model: model.trim() })}
                            />
                        </Field>
                    );
                })}
                <ProviderTestButton
                    providerId={providerId}
                    savedInputs={[config?.apiKey, baseUrl, activeModel].join('\n')}
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
    onSave: (update: AiSettingsUpdate) => void;
}) {
    const { t } = useTranslation();
    const activeModel = resolveActiveModel(settings);

    function updateCustom(patch: Partial<AiCustomProviderConfig>) {
        onSave((current) => ({
            customProviders: current.customProviders.map((p) =>
                p.id === provider.id ? { ...p, ...patch } : p,
            ),
        }));
    }

    function saveBaseUrl(value: string) {
        updateCustom({ baseUrl: cleanBaseUrl(value) });
    }

    function deleteCustom() {
        onSave((current) => ({
            customProviders: current.customProviders.filter((p) => p.id !== provider.id),
            activeProvider: current.activeProvider === provider.id ? null : current.activeProvider,
        }));
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
                    <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label={t('Supprimer le fournisseur {{name}}', {
                            name: provider.name,
                        })}
                    />
                </Popconfirm>
            }
        >
            <Space orientation="vertical" style={{ width: '100%' }} size="small">
                <Field label={t('URL de base')} htmlFor={fieldId(provider.id, 'baseUrl')}>
                    <DebouncedInput
                        id={fieldId(provider.id, 'baseUrl')}
                        value={provider.baseUrl}
                        onChange={saveBaseUrl}
                        validate={(val) => baseUrlError(t, val, { required: true })}
                        normalize={cleanBaseUrl}
                        placeholder="http://127.0.0.1:1234/v1"
                    />
                </Field>
                <Field label={t('Clé API')} htmlFor={fieldId(provider.id, 'apiKey')}>
                    <DebouncedInput
                        id={fieldId(provider.id, 'apiKey')}
                        password
                        value={provider.apiKey ?? ''}
                        onChange={(val) => updateCustom({ apiKey: normalizeApiKey(val) })}
                        normalize={trimValue}
                        placeholder={t('Optionnel')}
                    />
                </Field>
                <Field
                    label={t('Modèle')}
                    htmlFor={fieldId(provider.id, 'model')}
                    hint={defaultModelHint(t, provider.defaultModel)}
                >
                    <ModelSelect
                        id={fieldId(provider.id, 'model')}
                        providerId={provider.id}
                        value={provider.model ?? ''}
                        defaultModel={provider.defaultModel}
                        apiKey={provider.apiKey}
                        baseUrl={provider.baseUrl}
                        onChange={(model) => updateCustom({ model: model.trim() })}
                    />
                </Field>
                <ProviderTestButton
                    providerId={provider.id}
                    savedInputs={[provider.apiKey, provider.baseUrl, activeModel].join('\n')}
                />
            </Space>
        </Card>
    );
}
