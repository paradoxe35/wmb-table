import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AutoComplete, Button, Card, Divider, Popconfirm, Space, Tag } from 'antd';
import {
    CheckCircleOutlined,
    CloudOutlined,
    CloseCircleOutlined,
    DeleteOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
    resolveActiveModel,
    DEFAULT_MODELS,
    DEFAULT_PROVIDER_BASE_URLS,
    BUILTIN_PROVIDER_REQUIRES_API_KEY,
    RECOMMENDED_MIN_CONTEXT_WINDOW,
    type AiBuiltinProviderId,
    type AiCustomProviderConfig,
    type AiProviderDefinition,
    type AiRemoteModel,
    type AiSettings,
} from '@shared/ai.types';
import { useAiChatStore } from '@renderer/stores';
import { debounce } from '@renderer/utils/functions';
import DebouncedInput from '@renderer/components/debounced-input';
import { ApiKeyLink, Field, Hint } from './ai-shared';

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
                setErrorMessage(t(result.error));
            }
        } catch {
            setStatus('error');
            setErrorMessage(t('La connexion a échoué.'));
        }
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Button
                size="small"
                onClick={handleTest}
                disabled={!model || status === 'testing'}
                loading={status === 'testing'}
                style={{ flexShrink: 0 }}
            >
                {t('Tester la connexion')}
            </Button>
            {status === 'success' ? (
                <Tag icon={<CheckCircleOutlined />} color="success">
                    {t('Connecté')}
                </Tag>
            ) : null}
            {status === 'error' ? (
                <Tag
                    icon={<CloseCircleOutlined />}
                    color="error"
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={errorMessage}
                >
                    {errorMessage || t('Échec')}
                </Tag>
            ) : null}
        </div>
    );
}

function ModelContextWarning({
    providerId,
    model,
    baseUrl,
    listedContextWindow,
}: {
    providerId: string;
    model: string;
    baseUrl?: string;
    listedContextWindow?: number;
}) {
    const { t } = useTranslation();
    const [contextWindow, setContextWindow] = useState<number>();

    useEffect(() => {
        if (!model) {
            setContextWindow(undefined);
            return;
        }
        if (listedContextWindow) {
            setContextWindow(listedContextWindow);
            return;
        }

        let active = true;
        window.api.ai
            .getModelLimits({ providerId, model, baseUrl })
            .then((limits) => active && setContextWindow(limits.contextWindow))
            .catch(() => active && setContextWindow(undefined));

        return () => {
            active = false;
        };
    }, [providerId, model, baseUrl, listedContextWindow]);

    if (!contextWindow || contextWindow >= RECOMMENDED_MIN_CONTEXT_WINDOW) {
        return null;
    }

    return (
        <Alert
            type="warning"
            showIcon
            style={{ marginBlockStart: 8 }}
            title={t(
                "Ce modèle a une mémoire limitée : lors des longues conversations, l'assistant peut oublier le début. Si possible, choisissez un autre modèle.",
            )}
        />
    );
}

// ── Model select with fetch + custom entry ──

function ModelSelect({
    providerId,
    value,
    defaultModel,
    apiKey,
    baseUrl,
    onChange,
}: {
    providerId: string;
    value: string | null | undefined;
    defaultModel?: string | null;
    apiKey?: string;
    baseUrl?: string;
    onChange: (model: string) => void;
}) {
    const { t } = useTranslation();
    const [localValue, setLocalValue] = useState(value ?? '');
    const [models, setModels] = useState<AiRemoteModel[]>([]);
    const [fetched, setFetched] = useState(false);

    // Sync local state when external value changes (e.g. settings reload)
    useEffect(() => {
        const nextValue = value ?? '';
        setLocalValue((current) => (current === nextValue ? current : nextValue));
    }, [value]);

    // Debounced save — lets the user type freely without cursor jumps
    const debouncedOnChange = useMemo(() => debounce(onChange, 500), [onChange]);
    useEffect(() => () => debouncedOnChange.cancel(), [debouncedOnChange]);

    const handleChange = useCallback(
        (val: string) => {
            setLocalValue(val);
            debouncedOnChange(val);
        },
        [debouncedOnChange],
    );

    const handleSelect = useCallback(
        (val: string) => {
            setLocalValue(val);
            debouncedOnChange.cancel();
            onChange(val);
        },
        [onChange, debouncedOnChange],
    );

    const handleBlur = useCallback(() => {
        if (localValue.trim() || !defaultModel) {
            return;
        }

        debouncedOnChange.cancel();
        setLocalValue(defaultModel);
        onChange(defaultModel);
    }, [localValue, defaultModel, debouncedOnChange, onChange]);

    const fetchModels = useCallback(async () => {
        try {
            setModels(await window.api.ai.fetchProviderModels({ providerId, apiKey, baseUrl }));
            setFetched(true);
        } catch {
            // Fetch failed — user can still type a custom model
        }
    }, [providerId, apiKey, baseUrl]);

    // Fetch once when ready (API key available, or custom provider with baseUrl)
    useEffect(() => {
        if (!fetched && (apiKey || baseUrl)) {
            fetchModels();
        }
    }, [apiKey, baseUrl, fetched, fetchModels]);

    // Reset when provider/apiKey/baseUrl changes
    useEffect(() => {
        setFetched(false);
        setModels([]);
    }, [providerId, apiKey, baseUrl]);

    // Ensure the current value is always in the options list
    const allOptions = models.map((m) => ({
        value: m.id,
        label: m.name !== m.id ? `${m.name} (${m.id})` : m.id,
    }));
    if (localValue && !allOptions.some((o) => o.value === localValue)) {
        allOptions.unshift({ value: localValue, label: localValue });
    }

    return (
        <>
            <AutoComplete
                value={localValue}
                placeholder={t('Sélectionner ou saisir un modèle')}
                onChange={handleChange}
                onSelect={handleSelect}
                onBlur={handleBlur}
                options={allOptions}
                filterOption={(input, option) => {
                    return (
                        ((option?.label as string) ?? '')
                            .toLowerCase()
                            .includes(input.toLowerCase()) ||
                        (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                    );
                }}
                onDropdownVisibleChange={(open) => {
                    if (open && !fetched && (apiKey || baseUrl)) fetchModels();
                }}
                style={{ width: '100%' }}
            />
            <ModelContextWarning
                providerId={providerId}
                model={value ?? ''}
                baseUrl={baseUrl}
                listedContextWindow={models.find((m) => m.id === value)?.contextWindow}
            />
        </>
    );
}

function defaultModelHint(
    t: (k: string) => string,
    defaultModel?: string | null,
): string | undefined {
    return defaultModel ? `${t('Modèle par défaut')}: ${defaultModel}` : undefined;
}

function defaultBaseUrlHint(t: (k: string) => string, defaultBaseUrl?: string): string | undefined {
    return defaultBaseUrl ? `${t('URL par défaut')}: ${defaultBaseUrl}` : undefined;
}

// ── Provider configs ──

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
    const activeModel = resolveActiveModel(settings);

    const requiresApiKey =
        BUILTIN_PROVIDER_REQUIRES_API_KEY[provider.id as AiBuiltinProviderId] ?? true;

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
            <Space orientation="vertical" style={{ width: '100%' }} size="small">
                {provider.configurableFields.map((field) => {
                    if (field.key === 'apiKey') {
                        return (
                            <Field key={field.key} label={t('Clé API')}>
                                <>
                                    <DebouncedInput
                                        password
                                        value={config?.apiKey ?? ''}
                                        onChange={(val) => updateField('apiKey', val)}
                                        placeholder={requiresApiKey ? t('Clé API') : t('Optionnel')}
                                    />
                                    {provider.apiKeyUrl ? <ApiKeyLink provider={provider} /> : null}
                                </>
                            </Field>
                        );
                    }
                    if (field.key === 'baseUrl') {
                        return (
                            <Field
                                key={field.key}
                                label={t('URL de base')}
                                hint={defaultBaseUrlHint(
                                    t,
                                    DEFAULT_PROVIDER_BASE_URLS[provider.id as AiBuiltinProviderId],
                                )}
                            >
                                <DebouncedInput
                                    value={
                                        config?.baseUrl ??
                                        DEFAULT_PROVIDER_BASE_URLS[
                                            provider.id as AiBuiltinProviderId
                                        ] ??
                                        ''
                                    }
                                    onChange={(val) => updateField('baseUrl', val)}
                                    placeholder={
                                        DEFAULT_PROVIDER_BASE_URLS[
                                            provider.id as AiBuiltinProviderId
                                        ] ?? 'https://...'
                                    }
                                />
                            </Field>
                        );
                    }
                    return (
                        <Field
                            key={field.key}
                            label={t('Modèle')}
                            hint={defaultModelHint(
                                t,
                                DEFAULT_MODELS[provider.id as AiBuiltinProviderId],
                            )}
                        >
                            <ModelSelect
                                providerId={provider.id}
                                value={config?.model ?? ''}
                                defaultModel={DEFAULT_MODELS[provider.id]}
                                apiKey={config?.apiKey}
                                baseUrl={
                                    config?.baseUrl ??
                                    DEFAULT_PROVIDER_BASE_URLS[provider.id as AiBuiltinProviderId]
                                }
                                onChange={(model) => updateField('model', model)}
                            />
                        </Field>
                    );
                })}
                <TestButton
                    providerId={provider.id}
                    model={activeModel}
                    apiKey={config?.apiKey}
                    baseUrl={
                        config?.baseUrl ??
                        DEFAULT_PROVIDER_BASE_URLS[provider.id as AiBuiltinProviderId]
                    }
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
    const activeModel = resolveActiveModel(settings);

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
            <Space orientation="vertical" style={{ width: '100%' }} size="small">
                <Field label={t('URL de base')}>
                    <DebouncedInput
                        value={provider.baseUrl}
                        onChange={(val) => updateCustom({ baseUrl: val })}
                        placeholder="http://127.0.0.1:1234/v1"
                    />
                </Field>
                <Field label={t('Clé API')}>
                    <DebouncedInput
                        password
                        value={provider.apiKey ?? ''}
                        onChange={(val) => updateCustom({ apiKey: val })}
                        placeholder={t('Optionnel')}
                    />
                </Field>
                <Field label={t('Modèle')} hint={defaultModelHint(t, provider.defaultModel)}>
                    <ModelSelect
                        providerId={provider.id}
                        value={provider.model ?? ''}
                        defaultModel={provider.defaultModel}
                        apiKey={provider.apiKey}
                        baseUrl={provider.baseUrl}
                        onChange={(model) => updateCustom({ model })}
                    />
                </Field>
                <TestButton
                    providerId={provider.id}
                    model={activeModel}
                    apiKey={provider.apiKey}
                    baseUrl={provider.baseUrl}
                />
            </Space>
        </Card>
    );
}
