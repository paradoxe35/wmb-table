import { useCallback, useEffect, useState } from 'react';
import { Collapse, Input, message, Select, Space, Typography } from 'antd';
import type { TtsProviderInfo, TtsVoice } from '@shared/tts.types';
import { Field, providerUpdate, type ProviderConfigProps } from './tts-shared';
import { ClonedVoicesList, VoiceCloneForm } from './tts-qwen-voice-clone';

const { Text } = Typography;

interface QwenConfigProps extends ProviderConfigProps {
    info?: TtsProviderInfo;
}

export default function QwenConfig({ settings, info, onUpdate }: QwenConfigProps) {
    const cfg = settings.providers.qwen;
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
            onUpdate(providerUpdate(settings, 'qwen', 'voiceId', voiceId));
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
                label="Clé API DashScope"
                hint="Votre clé secrète Qwen. Elle est stockée en toute sécurité sur votre ordinateur."
            >
                <Input.Password
                    value={cfg.apiKey ?? ''}
                    placeholder="sk-..."
                    onChange={(e) =>
                        onUpdate(providerUpdate(settings, 'qwen', 'apiKey', e.target.value))
                    }
                />
            </Field>
            <Field label="Modèle" hint="Le choix par défaut convient pour la plupart des usages.">
                <Select
                    style={{ width: '100%' }}
                    value={cfg.model ?? 'qwen3-tts-flash'}
                    onChange={(v) => onUpdate(providerUpdate(settings, 'qwen', 'model', v))}
                    options={(info?.availableModels ?? []).map((m) => ({ label: m, value: m }))}
                />
            </Field>
            <Field label="Voix" hint="Les voix marquées « cloné » sont vos voix personnalisées.">
                <Select
                    style={{ width: '100%' }}
                    value={cfg.voiceId ?? 'Cherry'}
                    showSearch
                    optionFilterProp="label"
                    onChange={(v) => onUpdate(providerUpdate(settings, 'qwen', 'voiceId', v))}
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
