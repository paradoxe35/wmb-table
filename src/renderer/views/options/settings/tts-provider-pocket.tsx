import { useCallback, useState } from 'react';
import { Button, message, Select, Space } from 'antd';
import { SoundOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores/app.store';
import { useResolvedUiLanguage } from '@renderer/hooks';
import { getErrorMessage } from '@renderer/utils/functions';
import { ttsAudioPlayer } from '@renderer/services/tts-audio-player';
import type { TtsProviderInfo } from '@shared/tts.types';
import {
    Field,
    groupVoicesByLanguage,
    providerUpdate,
    type ProviderConfigProps,
} from './tts-shared';

const PROVIDER_TYPE = 'pocket' as const;

interface PocketConfigProps extends ProviderConfigProps {
    info?: TtsProviderInfo;
}

export default function PocketConfig({ settings, info, onUpdate }: PocketConfigProps) {
    const { t } = useTranslation();
    const cfg = settings.providers.pocket;
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const uiLanguage = useResolvedUiLanguage();
    const [auditioning, setAuditioning] = useState(false);

    const audition = useCallback(async () => {
        if (!cfg.voiceId || auditioning) return;
        setAuditioning(true);
        try {
            const result = await window.api.tts.previewVoice(contentLanguage ?? 'fr', cfg.voiceId);
            ttsAudioPlayer.play(result.audioBase64, result.mimeType, settings.rate ?? 1);
        } catch (err) {
            message.error(t(getErrorMessage(err, 'Erreur lors de la prévisualisation de la voix')));
        } finally {
            setAuditioning(false);
        }
    }, [auditioning, cfg.voiceId, contentLanguage, settings.rate, t]);

    const voiceGroups = groupVoicesByLanguage(
        info?.voices ?? [],
        uiLanguage,
        contentLanguage ?? undefined,
    );

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
            <Field
                label={t('Voix')}
                hint={t('Les voix sont regroupées par langue. Aucun téléchargement nécessaire.')}
            >
                <Space.Compact style={{ width: '100%' }}>
                    <Select
                        style={{ width: '100%' }}
                        value={cfg.voiceId || undefined}
                        showSearch
                        optionFilterProp="label"
                        placeholder={t('Sélectionnez une voix')}
                        options={voiceGroups}
                        onChange={(value) => {
                            onUpdate(providerUpdate(settings, PROVIDER_TYPE, 'voiceId', value));
                        }}
                    />
                    <Button
                        icon={<SoundOutlined />}
                        loading={auditioning}
                        disabled={!cfg.voiceId}
                        onClick={() => void audition()}
                    />
                </Space.Compact>
            </Field>
        </Space>
    );
}
