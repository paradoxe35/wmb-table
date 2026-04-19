import { useCallback, useRef, useState } from 'react';
import { Button, message, Space, Tag, Typography } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
    TTS_REFERENCE_VOICES,
    type TtsProviderType,
    type TtsReferenceVoiceAudio,
    type TtsVoice,
} from '@shared/tts.types';
import { getErrorMessage } from '@renderer/utils/functions';
import { Field } from './tts-shared';

const { Text } = Typography;

interface TtsReferenceVoicesProps {
    providerType: TtsProviderType;
    clonedVoices: TtsVoice[];
    onVoiceCloned: (voiceId: string) => void;
    /** Default language to pass when cloning (required by some providers like Cartesia). */
    cloneLanguage?: string;
}

/** Checks if a reference voice has already been cloned for the provider */
function isAlreadyCloned(refId: string, clonedVoices: TtsVoice[]): boolean {
    return clonedVoices.some(
        (v) => v.name === refId || v.name.toLowerCase() === refId.replace(/_/g, ' ').toLowerCase(),
    );
}

export default function TtsReferenceVoices({
    providerType,
    clonedVoices,
    onVoiceCloned,
    cloneLanguage,
}: TtsReferenceVoicesProps) {
    const { t } = useTranslation();
    const [cloningId, setCloningId] = useState<string | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioUrlRef = useRef<string | null>(null);
    // Cache fetched audio to avoid re-reading for play then clone
    const audioCache = useRef<Map<string, TtsReferenceVoiceAudio>>(new Map());

    const clearCurrentAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
        }
    }, []);

    const fetchAudio = useCallback(async (refId: string): Promise<TtsReferenceVoiceAudio> => {
        const cached = audioCache.current.get(refId);
        if (cached) {
            return cached;
        }
        const audio = await window.api.tts.getReferenceVoiceAudio(refId);
        audioCache.current.set(refId, audio);
        return audio;
    }, []);

    const handlePlay = useCallback(
        async (refId: string) => {
            // If already playing this voice, stop it
            if (playingId === refId && audioRef.current) {
                clearCurrentAudio();
                setPlayingId(null);
                return;
            }

            // Stop any current playback
            clearCurrentAudio();

            try {
                const { audioBase64, mimeType } = await fetchAudio(refId);
                const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
                const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
                const audio = new Audio(blobUrl);

                audioUrlRef.current = blobUrl;
                audio.onended = () => {
                    clearCurrentAudio();
                    setPlayingId(null);
                };
                audioRef.current = audio;
                setPlayingId(refId);
                await audio.play();
            } catch (err) {
                clearCurrentAudio();
                setPlayingId(null);
                message.error(t(getErrorMessage(err, 'Erreur lors de la lecture')));
            }
        },
        [clearCurrentAudio, playingId, fetchAudio, t],
    );

    const handleClone = useCallback(
        async (refId: string) => {
            setCloningId(refId);
            try {
                const { audioBase64 } = await fetchAudio(refId);
                const result = await window.api.tts.cloneVoice(providerType, {
                    name: refId,
                    audioBase64,
                    ...(cloneLanguage ? { language: cloneLanguage } : {}),
                });
                message.success(t('Voix clonée avec succès'));
                onVoiceCloned(result.voiceId);
            } catch (err) {
                message.error(t('Erreur: {{error}}', { error: t(getErrorMessage(err)) }));
            } finally {
                setCloningId(null);
            }
        },
        [providerType, fetchAudio, onVoiceCloned, t],
    );

    if (TTS_REFERENCE_VOICES.length === 0) {
        return null;
    }

    return (
        <Field
            label={t('Voix de référence')}
            hint={t('Voix intégrées pour le clonage vocal. Clonez-les pour les utiliser.')}
        >
            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                {TTS_REFERENCE_VOICES.map((ref) => {
                    const cloned = isAlreadyCloned(ref.id, clonedVoices);
                    const isCloning = cloningId === ref.id;
                    const isPlaying = playingId === ref.id;

                    return (
                        <div
                            key={ref.id}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '4px 0',
                            }}
                        >
                            <Text style={{ fontSize: 'var(--fs-rel-3xl)' }}>{ref.name}</Text>
                            <Space size="small">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={
                                        isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />
                                    }
                                    onClick={() => handlePlay(ref.id)}
                                    title={t('Écouter')}
                                />
                                {cloned ? (
                                    <Tag color="green">{t('Cloné')}</Tag>
                                ) : (
                                    <Button
                                        size="small"
                                        icon={<SyncOutlined spin={isCloning} />}
                                        loading={isCloning}
                                        disabled={isCloning || cloningId !== null}
                                        onClick={() => handleClone(ref.id)}
                                    >
                                        {t('Cloner')}
                                    </Button>
                                )}
                            </Space>
                        </div>
                    );
                })}
            </Space>
        </Field>
    );
}
