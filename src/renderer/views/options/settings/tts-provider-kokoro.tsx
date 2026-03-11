import { useCallback, useEffect, useState } from 'react';
import { Button, message, Progress, Select, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTtsStore } from '@renderer/stores/tts.store';
import type { TtsProviderInfo } from '@shared/tts.types';
import { getErrorMessage } from '@renderer/utils/functions';
import {
    Field,
    groupVoicesByLanguage,
    providerUpdate,
    type ProviderConfigProps,
} from './tts-shared';

interface KokoroConfigProps extends ProviderConfigProps {
    info?: TtsProviderInfo;
}

export default function KokoroConfig({ settings, info, onUpdate }: KokoroConfigProps) {
    const { t } = useTranslation();
    const cfg = settings.providers.kokoro;
    const allVoices = info?.voices ?? [];

    const [downloadPct, setDownloadPct] = useState<number | null>(null);

    useEffect(() => {
        return window.api.on.ttsModelDownloadProgress((p) => {
            if (p.provider === 'kokoro') {
                setDownloadPct(p.percentage);
                if (p.status === 'complete') {
                    message.success(t('Modèle Kokoro téléchargé'));
                    window.api.tts.getProviders().then(useTtsStore.getState().setProviders);
                    setTimeout(() => setDownloadPct(null), 1000);
                }
                if (p.status === 'error') {
                    message.error(t('Erreur: {{error}}', { error: p.error }));
                    setDownloadPct(null);
                }
            }
        });
    }, [t]);

    const handleDownload = useCallback(() => {
        setDownloadPct(0);
        window.api.tts.downloadModel('kokoro').catch((err) => {
            message.error(t('Erreur: {{error}}', { error: getErrorMessage(err) }));
            setDownloadPct(null);
        });
    }, [t]);

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
            {!info?.modelDownloaded && (
                <Field
                    label={t('Modèle')}
                    hint={t('À télécharger une seule fois. Environ 160 Mo.')}
                >
                    <div>
                        {downloadPct !== null ? (
                            <Progress percent={downloadPct} size="small" />
                        ) : (
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={handleDownload}
                                size="small"
                            >
                                {t('Télécharger le modèle')}
                            </Button>
                        )}
                    </div>
                </Field>
            )}
            <Field
                label={t('Voix')}
                hint={t(
                    'Toutes les voix sont disponibles. La voix par défaut correspond à la langue active.',
                )}
            >
                <Select
                    style={{ width: '100%' }}
                    value={cfg.voiceId ?? 'af_heart'}
                    showSearch
                    optionFilterProp="label"
                    onChange={(v) => onUpdate(providerUpdate(settings, 'kokoro', 'voiceId', v))}
                    options={groupVoicesByLanguage(allVoices)}
                />
            </Field>
        </Space>
    );
}
