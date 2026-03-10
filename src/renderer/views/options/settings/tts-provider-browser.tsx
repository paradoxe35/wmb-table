import { useEffect, useState } from 'react';
import { Select, Slider, Space } from 'antd';
import { Field, providerUpdate, type ProviderConfigProps } from './tts-shared';

function useBrowserVoices() {
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    useEffect(() => {
        const load = () => setVoices(window.speechSynthesis.getVoices());
        load();
        window.speechSynthesis.addEventListener('voiceschanged', load);
        return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
    }, []);
    return voices;
}

export default function BrowserConfig({ settings, onUpdate }: ProviderConfigProps) {
    const voices = useBrowserVoices();
    const cfg = settings.providers.browser;

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
            <Field
                label="Voix"
                hint="Les voix disponibles dépendent de celles installées sur votre ordinateur."
            >
                <Select
                    style={{ width: '100%' }}
                    value={cfg.voiceId ?? ''}
                    placeholder="Voix par défaut du système"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    onChange={(v) =>
                        onUpdate(providerUpdate(settings, 'browser', 'voiceId', v || undefined))
                    }
                    options={voices.map((v) => ({
                        label: `${v.name} (${v.lang})`,
                        value: v.voiceURI,
                    }))}
                />
            </Field>
            <Field label={`Hauteur: ${cfg.pitch ?? 1}`} hint="Ajuste la tonalité de la voix.">
                <Slider
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={cfg.pitch ?? 1}
                    onChange={(v) => onUpdate(providerUpdate(settings, 'browser', 'pitch', v))}
                />
            </Field>
            <Field label={`Volume: ${Math.round((cfg.volume ?? 1) * 100)}%`}>
                <Slider
                    min={0}
                    max={1}
                    step={0.1}
                    value={cfg.volume ?? 1}
                    onChange={(v) => onUpdate(providerUpdate(settings, 'browser', 'volume', v))}
                />
            </Field>
        </Space>
    );
}
