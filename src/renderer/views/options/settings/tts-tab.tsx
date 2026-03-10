import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Button,
    Card,
    Divider,
    Radio,
    Select,
    Slider,
    Space,
    Statistic,
    Switch,
    Typography,
    message,
} from 'antd';
import { useTtsStore } from '@renderer/stores/tts.store';
import type { TtsProviderType, TtsSettings } from '@shared/tts.types';
import {
    PROVIDER_LABELS,
    PROVIDER_HINTS,
    LocalityTag,
    Field,
    Hint,
    formatBytes,
} from './tts-shared';
import BrowserConfig from './tts-provider-browser';
import KokoroConfig from './tts-provider-kokoro';
import SherpaConfig from './tts-provider-sherpa';
import QwenConfig from './tts-provider-qwen';
import OpenAIConfig from './tts-provider-openai';

const { Text } = Typography;

// ── Active provider config renderer ──

function ActiveProviderConfig({
    settings,
    onUpdate,
}: {
    settings: TtsSettings;
    onUpdate: (s: Partial<TtsSettings>) => void;
}) {
    const providers = useTtsStore((s) => s.providers);
    const getInfo = (type: TtsProviderType) => providers.find((p) => p.type === type);

    switch (settings.activeProvider) {
        case 'browser':
            return <BrowserConfig settings={settings} onUpdate={onUpdate} />;
        case 'kokoro':
            return (
                <KokoroConfig settings={settings} info={getInfo('kokoro')} onUpdate={onUpdate} />
            );
        case 'sherpa':
            return (
                <SherpaConfig settings={settings} info={getInfo('sherpa')} onUpdate={onUpdate} />
            );
        case 'qwen':
            return <QwenConfig settings={settings} info={getInfo('qwen')} onUpdate={onUpdate} />;
        case 'openai':
            return (
                <OpenAIConfig settings={settings} info={getInfo('openai')} onUpdate={onUpdate} />
            );
        default:
            return null;
    }
}

// ── Main tab ──

export default function TtsTab() {
    const settings = useTtsStore((s) => s.settings);
    const setSettings = useTtsStore((s) => s.setSettings);
    const setProviders = useTtsStore((s) => s.setProviders);
    const [cacheSize, setCacheSize] = useState(0);

    useEffect(() => {
        window.api.tts.getSettings().then(setSettings);
        window.api.tts.getProviders().then(setProviders);
        window.api.tts.getCacheSize().then(setCacheSize);
    }, [setSettings, setProviders]);

    const handleUpdate = useCallback(
        (partial: Partial<TtsSettings>) => {
            if (!settings) return;
            const updated = { ...settings, ...partial };
            if (partial.providers) {
                updated.providers = { ...settings.providers, ...partial.providers };
            }
            setSettings(updated);
            window.api.tts.updateSettings(partial);
        },
        [settings, setSettings],
    );

    const handleClearCache = useCallback(async () => {
        await window.api.tts.clearCache();
        setCacheSize(0);
        message.success('Cache TTS vidé');
    }, []);

    if (!settings) return null;

    const locality = ['browser', 'kokoro', 'sherpa'].includes(settings.activeProvider)
        ? 'local'
        : 'remote';

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            {/* Active provider selector */}
            <Card size="small">
                <Field
                    label="Fournisseur actif"
                    hint="Le service qui lira le texte à voix haute. Si celui-ci ne fonctionne pas, un autre sera utilisé automatiquement."
                >
                    <Select
                        style={{ width: '100%' }}
                        value={settings.activeProvider}
                        onChange={(v) => handleUpdate({ activeProvider: v })}
                        options={Object.entries(PROVIDER_LABELS).map(([key, label]) => ({
                            label,
                            value: key,
                        }))}
                    />
                </Field>
                <Alert
                    type="info"
                    showIcon={false}
                    style={{ marginTop: 8 }}
                    title={
                        <Text type="secondary" style={{ fontSize: '0.8em' }}>
                            {PROVIDER_HINTS[settings.activeProvider]}
                        </Text>
                    }
                />
            </Card>

            {/* Active provider config */}
            <Card
                size="small"
                title={
                    <span>
                        {PROVIDER_LABELS[settings.activeProvider]}{' '}
                        <LocalityTag type={locality as 'local' | 'remote'} />
                    </span>
                }
            >
                <ActiveProviderConfig settings={settings} onUpdate={handleUpdate} />
            </Card>

            {/* Highlight & playback */}
            <Card size="small">
                <Space orientation="vertical" style={{ width: '100%' }} size="small">
                    <Field
                        label="Mode de surlignage"
                        hint="Choisissez comment le texte est mis en évidence pendant la lecture."
                    >
                        <Radio.Group
                            value={settings.highlightMode}
                            onChange={(e) => handleUpdate({ highlightMode: e.target.value })}
                        >
                            <Radio value="sentence">Phrase</Radio>
                            <Radio value="paragraph">Paragraphe</Radio>
                            <Radio value="word">Mot</Radio>
                        </Radio.Group>
                    </Field>
                    <Divider style={{ margin: '4px 0' }} />
                    <Field label={`Vitesse de lecture: ${settings.rate ?? 1}x`}>
                        <Slider
                            min={0.5}
                            max={2}
                            step={0.1}
                            value={settings.rate ?? 1}
                            onChange={(v) => handleUpdate({ rate: v })}
                        />
                    </Field>
                    <Divider style={{ margin: '4px 0' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Switch
                            size="small"
                            checked={settings.autoPlay}
                            onChange={(v) => handleUpdate({ autoPlay: v })}
                        />
                        <div>
                            <Text style={{ fontSize: '0.9em' }}>Lecture automatique</Text>
                            <Hint>
                                {"Démarrer la lecture automatiquement à l'ouverture d'un document."}
                            </Hint>
                        </div>
                    </div>
                </Space>
            </Card>

            {/* Cache */}
            <Card size="small">
                <Field
                    label="Cache audio"
                    hint="Les lectures passées sont conservées pour une relecture plus rapide."
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            marginTop: 4,
                        }}
                    >
                        <Statistic
                            title="Utilisé"
                            value={formatBytes(cacheSize)}
                            valueStyle={{ fontSize: '1em' }}
                        />
                        <Statistic
                            title="Limite"
                            value={`${settings.cacheMaxSizeMb} Mo`}
                            valueStyle={{ fontSize: '1em' }}
                        />
                        <Button size="small" danger onClick={handleClearCache}>
                            Vider
                        </Button>
                    </div>
                </Field>
                <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: '0.8em' }}>
                        Taille maximale du cache
                    </Text>
                    <Slider
                        min={100}
                        max={2000}
                        step={100}
                        value={settings.cacheMaxSizeMb}
                        onChange={(v) => handleUpdate({ cacheMaxSizeMb: v })}
                        marks={{ 100: '100', 500: '500', 1000: '1 Go', 2000: '2 Go' }}
                    />
                </div>
            </Card>
        </Space>
    );
}
