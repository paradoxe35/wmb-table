import { useCallback, useEffect, useState } from 'react';
import { Collapse, Divider, message, Select, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TtsProviderInfo, TtsVoice } from '@shared/tts.types';
import { useTtsStore } from '@renderer/stores/tts.store';
import { useAppStore } from '@renderer/stores/app.store';
import { getErrorMessage } from '@renderer/utils/functions';
import DebouncedInput from '@renderer/components/debounced-input';
import {
    ApiKeyLink,
    Field,
    groupVoicesByLanguage,
    providerUpdate,
    type ProviderConfigProps,
} from './tts-shared';
import { ClonedVoicesList, VoiceCloneForm } from './tts-elevenlabs-voice-clone';
import TtsReferenceVoices from './tts-reference-voices';

const { Text } = Typography;

const PROVIDER_TYPE = 'cartesia' as const;

interface CartesiaConfigProps extends ProviderConfigProps {
    info?: TtsProviderInfo;
}

async function refreshVoices(setClonedVoices: (v: TtsVoice[]) => void): Promise<void> {
    const [cloned, providers] = await Promise.all([
        window.api.tts.listClonedVoices(PROVIDER_TYPE),
        window.api.tts.getProviders(),
    ]);
    setClonedVoices(cloned);
    useTtsStore.getState().setProviders(providers);
}

export default function CartesiaConfig({ settings, info, onUpdate }: CartesiaConfigProps) {
    const { t } = useTranslation();
    const cfg = settings.providers.cartesia;
    const [clonedVoices, setClonedVoices] = useState<TtsVoice[]>([]);

    useEffect(() => {
        if (!cfg.apiKey) return;
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

    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const allVoices = [
        ...(info?.voices ?? []),
        ...clonedVoices.filter((c) => !info?.voices.some((v) => v.id === c.id)),
    ];
    const voiceGroups = groupVoicesByLanguage(allVoices, contentLanguage ?? undefined);

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
            <Field
                label={t('Clé API Cartesia')}
                hint={t(
                    'Votre clé secrète Cartesia. Elle est stockée en toute sécurité sur votre ordinateur.',
                )}
            >
                <DebouncedInput
                    password
                    value={cfg.apiKey ?? ''}
                    placeholder="sk_car_..."
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
                    value={cfg.voiceId ?? undefined}
                    showSearch
                    optionFilterProp="label"
                    placeholder={t('Sélectionnez une voix')}
                    onChange={(v) => {
                        onUpdate(providerUpdate(settings, PROVIDER_TYPE, 'voiceId', v));
                    }}
                    options={voiceGroups}
                    filterOption={(input, option) => {
                        return option?.label?.toLowerCase().includes(input.toLowerCase()) || false;
                    }}
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
                                    cloneLanguage="fr"
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
                                    languages={info?.supportedLanguages}
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
