import { useCallback, useEffect, useState } from 'react';
import { Button, message, Progress, Select, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useAppStore } from '@renderer/stores';
import type { TtsProviderInfo } from '@shared/tts.types';
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
    const cfg = settings.providers.kokoro;
    const activeLanguage = useAppStore((s) => s.activeLanguage);

    const allVoices = info?.voices ?? [];
    const langCode = activeLanguage?.split('-')[0].toLowerCase() ?? '';

    // Auto-select a voice matching the active language when no voice is set or current doesn't match
    useEffect(() => {
        if (!langCode || allVoices.length === 0) return;
        const langVoices = allVoices.filter((v) => v.languageCodes.some((lc) => lc === langCode));
        if (langVoices.length === 0) return;
        const currentVoice = cfg.voiceId ?? 'af_heart';
        const currentMatchesLang = langVoices.some((v) => v.id === currentVoice);
        if (!currentMatchesLang) {
            onUpdate(providerUpdate(settings, 'kokoro', 'voiceId', langVoices[0].id));
        }
    }, [langCode]); // eslint-disable-line react-hooks/exhaustive-deps

    const [downloadPct, setDownloadPct] = useState<number | null>(null);

    useEffect(() => {
        return window.api.on.ttsModelDownloadProgress((p) => {
            if (p.provider === 'kokoro') {
                setDownloadPct(p.percentage);
                if (p.status === 'complete') {
                    message.success('Modèle Kokoro téléchargé');
                    setTimeout(() => setDownloadPct(null), 1000);
                }
                if (p.status === 'error') {
                    message.error(`Erreur: ${p.error}`);
                    setDownloadPct(null);
                }
            }
        });
    }, []);

    const handleDownload = useCallback(() => {
        setDownloadPct(0);
        window.api.tts.downloadModel('kokoro').catch((err) => {
            message.error(`Erreur: ${err.message}`);
            setDownloadPct(null);
        });
    }, []);

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
            {!info?.modelDownloaded && (
                <Field label="Modèle" hint="À télécharger une seule fois. Environ 160 Mo.">
                    <div>
                        {downloadPct !== null ? (
                            <Progress percent={downloadPct} size="small" />
                        ) : (
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={handleDownload}
                                size="small"
                            >
                                Télécharger le modèle
                            </Button>
                        )}
                    </div>
                </Field>
            )}
            <Field
                label="Voix"
                hint="Toutes les voix sont disponibles. La voix par défaut correspond à la langue active."
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
