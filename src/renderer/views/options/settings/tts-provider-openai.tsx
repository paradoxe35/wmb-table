import { Select, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TtsProviderInfo } from '@shared/tts.types';
import DebouncedInput from '@renderer/components/debounced-input';
import { ApiKeyLink, Field, providerUpdate, type ProviderConfigProps } from './tts-shared';

interface OpenAIConfigProps extends ProviderConfigProps {
    info?: TtsProviderInfo;
}

export default function OpenAIConfig({ settings, info, onUpdate }: OpenAIConfigProps) {
    const { t } = useTranslation();
    const cfg = settings.providers.openai;

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
            <Field
                label={t('Clé API OpenAI')}
                hint={t(
                    'Votre clé secrète OpenAI. Elle est stockée en toute sécurité sur votre ordinateur.',
                )}
            >
                <DebouncedInput
                    password
                    value={cfg.apiKey ?? ''}
                    placeholder="sk-..."
                    onChange={(val) => onUpdate(providerUpdate(settings, 'openai', 'apiKey', val))}
                />
                <ApiKeyLink provider="openai" />
            </Field>
            <Field label={t('Modèle')} hint={t('Le choix par défaut offre la meilleure qualité.')}>
                <Select
                    style={{ width: '100%' }}
                    value={cfg.model ?? info?.defaultModel ?? ''}
                    onChange={(v) => onUpdate(providerUpdate(settings, 'openai', 'model', v))}
                    options={(info?.availableModels ?? []).map((m) => ({ label: m, value: m }))}
                />
            </Field>
            <Field
                label={t('Voix')}
                hint={t('Marin et Cedar sont recommandées pour la meilleure qualité.')}
            >
                <Select
                    style={{ width: '100%' }}
                    value={cfg.voiceId ?? 'nova'}
                    onChange={(v) => onUpdate(providerUpdate(settings, 'openai', 'voiceId', v))}
                    options={(info?.voices ?? []).map((v) => ({
                        label: v.name,
                        value: v.id,
                    }))}
                />
            </Field>
        </Space>
    );
}
