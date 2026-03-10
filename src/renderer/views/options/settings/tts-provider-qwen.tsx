import { useCallback, useEffect, useState } from 'react';
import { Button, Input, message, Select, Space, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { TtsProviderInfo, TtsVoice } from '@shared/tts.types';
import { Field, providerUpdate, type ProviderConfigProps } from './tts-shared';

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

    const allVoices = [
        ...(info?.voices ?? []),
        ...clonedVoices.filter((c) => !info?.voices.some((v) => v.id === c.id)),
    ];

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
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
            <Field
                label="Endpoint"
                hint="Adresse du service. Ne modifiez que si on vous l'a demandé."
            >
                <Input
                    value={cfg.apiEndpoint ?? ''}
                    onChange={(e) =>
                        onUpdate(providerUpdate(settings, 'qwen', 'apiEndpoint', e.target.value))
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
            {clonedVoices.length > 0 && (
                <Field label="Voix clonées" hint="Vos voix personnalisées.">
                    <div>
                        {clonedVoices.map((v) => (
                            <div
                                key={v.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '4px 0',
                                }}
                            >
                                <Text style={{ fontSize: '0.9em' }}>{v.name}</Text>
                                <Button
                                    type="text"
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => handleDeleteVoice(v.id)}
                                />
                            </div>
                        ))}
                    </div>
                </Field>
            )}
        </Space>
    );
}
