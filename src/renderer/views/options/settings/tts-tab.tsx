import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Button,
    Card,
    Collapse,
    Divider,
    Input,
    message,
    Progress,
    Radio,
    Select,
    Slider,
    Space,
    Statistic,
    Switch,
    Tag,
    Typography,
} from 'antd';
import {
    CheckCircleOutlined,
    CloudOutlined,
    DeleteOutlined,
    DownloadOutlined,
    LaptopOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@renderer/stores';
import { useTtsStore } from '@renderer/stores/tts.store';
import type { TtsProviderInfo, TtsProviderType, TtsSettings, TtsVoice } from '@shared/tts.types';

const { Text } = Typography;

// ── Helpers ──

const PROVIDER_LABELS: Record<TtsProviderType, string> = {
    browser: 'Navigateur (SpeechSynthesis)',
    kokoro: 'Kokoro TTS (local)',
    qwen: 'Qwen AI TTS (DashScope)',
    openai: 'OpenAI TTS',
};

const PROVIDER_HINTS: Record<TtsProviderType, string> = {
    browser:
        'Gratuit, fonctionne sans connexion internet. Utilise les voix déjà installées sur votre ordinateur.',
    kokoro: 'Gratuit, fonctionne sans connexion internet. Bonne qualité, nécessite un premier téléchargement.',
    qwen: 'Très bonne qualité. Permet de créer une voix personnalisée. Nécessite un compte et une connexion internet.',
    openai: 'Excellente qualité, nombreuses langues disponibles. Nécessite un compte et une connexion internet.',
};

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Helper: build a partial settings update for a single provider field. */
function providerUpdate(
    settings: TtsSettings,
    provider: TtsProviderType,
    field: string,
    value: unknown,
): Partial<TtsSettings> {
    return {
        providers: {
            ...settings.providers,
            [provider]: { ...settings.providers[provider], [field]: value },
        },
    };
}

/** Hint text shown below a field label. */
function Hint({ children }: { children: string }) {
    return (
        <Text type="secondary" style={{ fontSize: '0.8em', display: 'block', marginTop: 2 }}>
            {children}
        </Text>
    );
}

/** Consistent field wrapper with label + optional hint. */
function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <Text strong style={{ fontSize: '0.9em' }}>
                {label}
            </Text>
            {hint && <Hint>{hint}</Hint>}
            <div style={{ marginTop: 4 }}>{children}</div>
        </div>
    );
}

/** Locality tag for provider panels. */
function LocalityTag({ type }: { type: 'local' | 'remote' }) {
    return type === 'local' ? (
        <Tag color="green" icon={<LaptopOutlined />}>
            Local
        </Tag>
    ) : (
        <Tag color="blue" icon={<CloudOutlined />}>
            Cloud
        </Tag>
    );
}

// ── Browser voices (renderer-only) ──

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

// ── Provider config panels ──

function BrowserConfig({
    settings,
    onUpdate,
}: {
    settings: TtsSettings;
    onUpdate: (s: Partial<TtsSettings>) => void;
}) {
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

function KokoroConfig({
    settings,
    info,
    onUpdate,
}: {
    settings: TtsSettings;
    info?: TtsProviderInfo;
    onUpdate: (s: Partial<TtsSettings>) => void;
}) {
    const cfg = settings.providers.kokoro;
    const activeLanguage = useAppStore((s) => s.activeLanguage);

    // Filter voices matching the active language, with all voices as fallback
    const allVoices = info?.voices ?? [];
    const langCode = activeLanguage?.split('-')[0].toLowerCase() ?? '';
    const filteredVoices = langCode
        ? allVoices.filter((v) => v.languageCodes.some((lc) => lc === langCode))
        : allVoices;
    const displayVoices = filteredVoices.length > 0 ? filteredVoices : allVoices;

    // Auto-select first voice matching the active language when current voice doesn't match
    useEffect(() => {
        if (!langCode || filteredVoices.length === 0) return;
        const currentVoice = cfg.voiceId ?? 'af_heart';
        const currentMatches = filteredVoices.some((v) => v.id === currentVoice);
        if (!currentMatches) {
            onUpdate(providerUpdate(settings, 'kokoro', 'voiceId', filteredVoices[0].id));
        }
    }, [langCode, filteredVoices.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <Field label="Modèle" hint="À télécharger une seule fois. Environ 160 Mo.">
                <div>
                    {info?.modelDownloaded ? (
                        <Tag color="green" icon={<CheckCircleOutlined />}>
                            Modèle prêt
                        </Tag>
                    ) : downloadPct !== null ? (
                        <Progress percent={downloadPct} size="small" />
                    ) : (
                        <Button icon={<DownloadOutlined />} onClick={handleDownload} size="small">
                            Télécharger le modèle
                        </Button>
                    )}
                </div>
            </Field>
            <Field
                label="Voix"
                hint={
                    langCode && filteredVoices.length > 0
                        ? `Voix disponibles pour votre langue. Les noms contenant « f » sont féminins, « m » sont masculins.`
                        : 'Choisissez une voix. Les noms contenant « f » sont féminins, « m » sont masculins.'
                }
            >
                <Select
                    style={{ width: '100%' }}
                    value={cfg.voiceId ?? 'af_heart'}
                    showSearch
                    optionFilterProp="label"
                    onChange={(v) => onUpdate(providerUpdate(settings, 'kokoro', 'voiceId', v))}
                    options={displayVoices.map((v) => ({
                        label: `${v.name} (${v.languageCodes.join(', ')})`,
                        value: v.id,
                    }))}
                />
            </Field>
        </Space>
    );
}

function QwenConfig({
    settings,
    info,
    onUpdate,
}: {
    settings: TtsSettings;
    info?: TtsProviderInfo;
    onUpdate: (s: Partial<TtsSettings>) => void;
}) {
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

function OpenAIConfig({
    settings,
    info,
    onUpdate,
}: {
    settings: TtsSettings;
    info?: TtsProviderInfo;
    onUpdate: (s: Partial<TtsSettings>) => void;
}) {
    const cfg = settings.providers.openai;

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
            <Field
                label="Clé API OpenAI"
                hint="Votre clé secrète OpenAI. Elle est stockée en toute sécurité sur votre ordinateur."
            >
                <Input.Password
                    value={cfg.apiKey ?? ''}
                    placeholder="sk-..."
                    onChange={(e) =>
                        onUpdate(providerUpdate(settings, 'openai', 'apiKey', e.target.value))
                    }
                />
            </Field>
            <Field label="Modèle" hint="Le choix par défaut offre la meilleure qualité.">
                <Select
                    style={{ width: '100%' }}
                    value={cfg.model ?? 'gpt-4o-mini-tts'}
                    onChange={(v) => onUpdate(providerUpdate(settings, 'openai', 'model', v))}
                    options={(info?.availableModels ?? []).map((m) => ({ label: m, value: m }))}
                />
            </Field>
            <Field label="Voix" hint="Marin et Cedar sont recommandées pour la meilleure qualité.">
                <Select
                    style={{ width: '100%' }}
                    value={cfg.voiceId ?? 'nova'}
                    onChange={(v) => onUpdate(providerUpdate(settings, 'openai', 'voiceId', v))}
                    options={(info?.voices ?? []).map((v) => ({
                        label: v.name,
                        value: v.id,
                    }))}
                />
            </Field>
        </Space>
    );
}

// ── Main tab ──

export default function TtsTab() {
    const settings = useTtsStore((s) => s.settings);
    const providers = useTtsStore((s) => s.providers);
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

    const getProviderInfo = (type: TtsProviderType) => providers.find((p) => p.type === type);
    const activeInfo = getProviderInfo(settings.activeProvider);

    const collapseItems = [
        {
            key: 'browser',
            label: (
                <span>
                    {PROVIDER_LABELS.browser} <LocalityTag type="local" />
                </span>
            ),
            children: <BrowserConfig settings={settings} onUpdate={handleUpdate} />,
        },
        {
            key: 'kokoro',
            label: (
                <span>
                    {PROVIDER_LABELS.kokoro} <LocalityTag type="local" />
                </span>
            ),
            children: (
                <KokoroConfig
                    settings={settings}
                    info={getProviderInfo('kokoro')}
                    onUpdate={handleUpdate}
                />
            ),
        },
        {
            key: 'qwen',
            label: (
                <span>
                    {PROVIDER_LABELS.qwen} <LocalityTag type="remote" />
                </span>
            ),
            children: (
                <QwenConfig
                    settings={settings}
                    info={getProviderInfo('qwen')}
                    onUpdate={handleUpdate}
                />
            ),
        },
        {
            key: 'openai',
            label: (
                <span>
                    {PROVIDER_LABELS.openai} <LocalityTag type="remote" />
                </span>
            ),
            children: (
                <OpenAIConfig
                    settings={settings}
                    info={getProviderInfo('openai')}
                    onUpdate={handleUpdate}
                />
            ),
        },
    ];

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            {/* Active provider */}
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
                {activeInfo && (
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
                )}
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

            {/* Provider configs */}
            <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Configuration des fournisseurs
                </Text>
                <Hint>Développez un fournisseur pour ajuster sa voix, vitesse et clé API.</Hint>
                <Collapse
                    items={collapseItems}
                    defaultActiveKey={[settings.activeProvider]}
                    style={{ marginTop: 8 }}
                />
            </div>

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
