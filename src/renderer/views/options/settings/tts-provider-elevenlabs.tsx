import { useCallback, useEffect, useState } from 'react';
import { Collapse, Input, message, Select, Space, Typography } from 'antd';
import type { TtsProviderInfo, TtsVoice } from '@shared/tts.types';
import { Field, providerUpdate, type ProviderConfigProps } from './tts-shared';
import { ClonedVoicesList, VoiceCloneForm } from './tts-elevenlabs-voice-clone';

const { Text } = Typography;

interface ElevenLabsConfigProps extends ProviderConfigProps {
    info?: TtsProviderInfo;
}

export default function ElevenLabsConfig({ settings, info, onUpdate }: ElevenLabsConfigProps) {
    const cfg = settings.providers.elevenlabs;
    const [clonedVoices, setClonedVoices] = useState<TtsVoice[]>([]);

    useEffect(() => {
        window.api.tts
            .listClonedVoices()
            .then(setClonedVoices)
            .catch(() => {});
    }, []);

    const handleDeleteVoice = useCallback(async (voiceId: string) => {
        try {
            await window.api.tts.deleteClonedVoice(voiceId);
            setClonedVoices((prev) => prev.filter((v) => v.id !== voiceId));
            message.success('Voix clonée supprimée');
        } catch (err) {
            message.error(`Erreur: ${(err as Error).message}`);
        }
    }, []);

    const handleVoiceCloned = useCallback(
        async (voiceId: string) => {
            const voices = await window.api.tts.listClonedVoices();
            setClonedVoices(voices);
            onUpdate(providerUpdate(settings, 'elevenlabs', 'voiceId', voiceId));
        },
        [settings, onUpdate],
    );

    const allVoices = [
        ...(info?.voices ?? []),
        ...clonedVoices.filter((c) => !info?.voices.some((v) => v.id === c.id)),
    ];

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Field
                label="Clé API ElevenLabs"
                hint="Votre clé secrète ElevenLabs. Elle est stockée en toute sécurité sur votre ordinateur."
            >
                <Input.Password
                    value={cfg.apiKey ?? ''}
                    placeholder="xi_..."
                    onChange={(e) =>
                        onUpdate(providerUpdate(settings, 'elevenlabs', 'apiKey', e.target.value))
                    }
                />
            </Field>
            <Field label="Modèle" hint="Le choix par défaut convient pour la plupart des usages.">
                <Select
                    style={{ width: '100%' }}
                    value={cfg.model ?? 'eleven_v3'}
                    onChange={(v) => onUpdate(providerUpdate(settings, 'elevenlabs', 'model', v))}
                    options={(info?.availableModels ?? []).map((m) => ({ label: m, value: m }))}
                />
            </Field>
            <Field label="Voix" hint="Les voix marquées « cloné » sont vos voix personnalisées.">
                <Select
                    style={{ width: '100%' }}
                    value={cfg.voiceId ?? 'JBFqnCBsd6RMkjVDRZzb'}
                    showSearch
                    optionFilterProp="label"
                    onChange={(v) => onUpdate(providerUpdate(settings, 'elevenlabs', 'voiceId', v))}
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
                            <Text strong style={{ fontSize: '0.9em' }}>
                                Paramètres avancés
                            </Text>
                        ),
                        children: (
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                <ClonedVoicesList
                                    voices={clonedVoices}
                                    onDelete={handleDeleteVoice}
                                />
                                <VoiceCloneForm onCloned={handleVoiceCloned} />
                            </Space>
                        ),
                    },
                ]}
            />
        </Space>
    );
}
