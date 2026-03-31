import { useCallback, useEffect, useState } from 'react';
import { Collapse, Divider, message, Select, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TtsProviderInfo, TtsVoice } from '@shared/tts.types';
import { useTtsStore } from '@renderer/stores/tts.store';
import { getErrorMessage } from '@renderer/utils/functions';
import DebouncedInput from '@renderer/components/debounced-input';
import { ApiKeyLink, Field, providerUpdate, type ProviderConfigProps } from './tts-shared';
import { ClonedVoicesList, VoiceCloneForm } from './tts-elevenlabs-voice-clone';
import TtsReferenceVoices from './tts-reference-voices';

const { Text } = Typography;

const PROVIDER_TYPE = 'elevenlabs' as const;

interface ElevenLabsConfigProps extends ProviderConfigProps {
    info?: TtsProviderInfo;
}

/** Refresh both cloned voices list and provider info (voice dropdown) */
async function refreshVoices(setClonedVoices: (v: TtsVoice[]) => void): Promise<void> {
    const [cloned, providers] = await Promise.all([
        window.api.tts.listClonedVoices(PROVIDER_TYPE),
        window.api.tts.getProviders(),
    ]);
    setClonedVoices(cloned);
    useTtsStore.getState().setProviders(providers);
}

export default function ElevenLabsConfig({ settings, info, onUpdate }: ElevenLabsConfigProps) {
    const { t } = useTranslation();
    const cfg = settings.providers.elevenlabs;
    const [clonedVoices, setClonedVoices] = useState<TtsVoice[]>([]);

    useEffect(() => {
        if (!cfg.apiKey) {
            return;
        }
        window.api.tts
            .listClonedVoices(PROVIDER_TYPE)
            .then(setClonedVoices)
            .catch(() => {});
    }, [cfg.apiKey]);

    const handleDeleteVoice = useCallback(
        async (voiceId: string) => {
            try {
                await window.api.tts.deleteClonedVoice(PROVIDER_TYPE, voiceId);
                await refreshVoices(setClonedVoices);
                message.success(t('Voix clonée supprimée'));
            } catch (err) {
                message.error(t('Erreur: {{error}}', { error: getErrorMessage(err) }));
            }
        },
        [t],
    );

    const handleVoiceCloned = useCallback(
        async (voiceId: string) => {
            await refreshVoices(setClonedVoices);
            onUpdate(providerUpdate(settings, PROVIDER_TYPE, 'voiceId', voiceId));
        },
        [settings, onUpdate],
    );

    const allVoices = [
        ...(info?.voices ?? []),
        ...clonedVoices.filter((c) => !info?.voices.some((v) => v.id === c.id)),
    ];

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
            <Field
                label={t('Clé API ElevenLabs')}
                hint={t(
                    'Votre clé secrète ElevenLabs. Elle est stockée en toute sécurité sur votre ordinateur.',
                )}
            >
                <DebouncedInput
                    password
                    value={cfg.apiKey ?? ''}
                    placeholder="xi_..."
                    onChange={(val) => {
                        onUpdate(providerUpdate(settings, PROVIDER_TYPE, 'apiKey', val));
                    }}
                />
                <ApiKeyLink provider={PROVIDER_TYPE} />
            </Field>
            <Field
                label={t('Voix')}
                hint={t('Les voix marquées « cloné » sont vos voix personnalisées.')}
            >
                <Select
                    style={{ width: '100%' }}
                    value={cfg.voiceId ?? 'JBFqnCBsd6RMkjVDRZzb'}
                    showSearch
                    optionFilterProp="label"
                    onChange={(v) => {
                        onUpdate(providerUpdate(settings, PROVIDER_TYPE, 'voiceId', v));
                    }}
                    options={allVoices.map((v) => ({
                        label: `${v.name}${v.isCloned ? ' (cloné)' : ''}`,
                        value: v.id,
                    }))}
                />
            </Field>
            <Collapse
                size="small"
                ghost
                items={[
                    {
                        key: 'advanced',
                        label: (
                            <Text strong style={{ fontSize: 'var(--fs-rel-3xl)' }}>
                                {t('Paramètres avancés')}
                            </Text>
                        ),
                        children: (
                            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                                <TtsReferenceVoices
                                    providerType={PROVIDER_TYPE}
                                    clonedVoices={clonedVoices}
                                    onVoiceCloned={handleVoiceCloned}
                                />
                                {clonedVoices.length > 0 && (
                                    <>
                                        <Divider style={{ margin: '4px 0' }} />
                                        <ClonedVoicesList
                                            voices={clonedVoices}
                                            onDelete={handleDeleteVoice}
                                        />
                                    </>
                                )}
                                <Divider style={{ margin: '4px 0' }} />
                                <VoiceCloneForm
                                    providerType={PROVIDER_TYPE}
                                    onCloned={handleVoiceCloned}
                                />
                                <Divider style={{ margin: '4px 0' }} />
                                <Field
                                    label={t('Modèle')}
                                    hint={t(
                                        'Le choix par défaut convient pour la plupart des usages.',
                                    )}
                                >
                                    <Select
                                        style={{ width: '100%' }}
                                        value={cfg.model ?? info?.defaultModel ?? ''}
                                        onChange={(v) => {
                                            onUpdate(
                                                providerUpdate(settings, PROVIDER_TYPE, 'model', v),
                                            );
                                        }}
                                        options={(info?.availableModels ?? []).map((m) => ({
                                            label: m,
                                            value: m,
                                        }))}
                                    />
                                </Field>
                            </Space>
                        ),
                    },
                ]}
            />
        </Space>
    );
}
