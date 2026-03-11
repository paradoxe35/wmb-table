import { Input, Select, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TtsProviderInfo } from '@shared/tts.types';
import { Field, providerUpdate, type ProviderConfigProps } from './tts-shared';

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
                <Input.Password
                    value={cfg.apiKey ?? ''}
                    placeholder="sk-..."
                    onChange={(e) =>
                        onUpdate(providerUpdate(settings, 'openai', 'apiKey', e.target.value))
                    }
                />
            </Field>
            <Field label={t('Modèle')} hint={t('Le choix par défaut offre la meilleure qualité.')}>
                <Select
                    style={{ width: '100%' }}
                    value={cfg.model ?? 'gpt-4o-mini-tts'}
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
