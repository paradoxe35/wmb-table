import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { BookOutlined, SoundOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTtsStore } from '@renderer/stores/tts.store';
import { useAppStore } from '@renderer/stores/app.store';
import { browserTts } from '@renderer/services/browser-tts';
import { ttsAudioPlayer } from '@renderer/services/tts-audio-player';
import { getTtsDemoText } from '@shared/tts-demo-texts';
import { SEGMENT_GAP_MS, type TtsProviderType, type TtsSettings } from '@shared/tts.types';
import { PROVIDER_CATALOG } from '@shared/tts.types';
import { LocalityTag, FreeTag, Field, Hint, formatBytes } from './tts-shared';
import { debounce, getErrorMessage } from '@renderer/utils/functions';
import BrowserConfig from './tts-provider-browser';
import SherpaConfig from './tts-provider-sherpa';
import ElevenLabsConfig from './tts-provider-elevenlabs';
import OpenAIConfig from './tts-provider-openai';
import EdgeConfig from './tts-provider-edge';
import CartesiaConfig from './tts-provider-cartesia';
import { buildDocsGuideLink } from '@renderer/utils/constants';

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
        case 'sherpa':
            return (
                <SherpaConfig settings={settings} info={getInfo('sherpa')} onUpdate={onUpdate} />
            );
        case 'elevenlabs':
            return (
                <ElevenLabsConfig
                    settings={settings}
                    info={getInfo('elevenlabs')}
                    onUpdate={onUpdate}
                />
            );
        case 'openai':
            return (
                <OpenAIConfig settings={settings} info={getInfo('openai')} onUpdate={onUpdate} />
            );
        case 'edge':
            return <EdgeConfig settings={settings} info={getInfo('edge')} onUpdate={onUpdate} />;
        case 'cartesia':
            return (
                <CartesiaConfig
                    settings={settings}
                    info={getInfo('cartesia')}
                    onUpdate={onUpdate}
                />
            );
        default:
            return null;
    }
}

// ── Main tab ──

export default function TtsTab() {
    const { t } = useTranslation();
    const settings = useTtsStore((s) => s.settings);
    const setSettings = useTtsStore((s) => s.setSettings);
    const setProviders = useTtsStore((s) => s.setProviders);
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const [cacheSize, setCacheSize] = useState(0);
    const [previewing, setPreviewing] = useState(false);

    const handlePreview = useCallback(async () => {
        if (!settings || previewing) return;
        const language = contentLanguage ?? 'fr';
        setPreviewing(true);
        try {
            if (settings.activeProvider === 'browser') {
                const cfg = settings.providers.browser;
                browserTts.speak(getTtsDemoText(language), cfg?.voiceId, {
                    rate: settings.rate ?? 1,
                    pitch: cfg?.pitch,
                    volume: cfg?.volume,
                });
            } else {
                if (settings.autoSwitchVoice) {
                    const resolved = await window.api.tts.resolveConfigForLanguage(language);
                    if (resolved) {
                        setSettings(resolved);
                    }
                }
                const result = await window.api.tts.previewVoice(language);
                ttsAudioPlayer.play(result.audioBase64, result.mimeType, settings.rate ?? 1);
            }
        } catch (err) {
            message.error(getErrorMessage(err, t('Erreur lors de la prévisualisation de la voix')));
        } finally {
            setPreviewing(false);
        }
    }, [settings, contentLanguage, previewing, setSettings, t]);

    useEffect(() => {
        window.api.tts.getSettings().then(setSettings);
        window.api.tts.getProviders().then(setProviders);
        window.api.tts.getCacheSize().then(setCacheSize);
    }, [setSettings, setProviders]);

    // Debounced IPC save — prevents excessive writes for frequent changes (rate, volume, etc.)
    // API key and provider changes bypass this and save immediately (see handleUpdate)
    const debouncedSave = useMemo(() => {
        return debounce((partial: Partial<TtsSettings>) => {
            window.api.tts.updateSettings(partial);
        }, 1000);
    }, []);

    // Cleanup debounce on unmount
    const debouncedSaveRef = useRef(debouncedSave);
    debouncedSaveRef.current = debouncedSave;
    useEffect(() => () => debouncedSaveRef.current.cancel(), []);

    const handleUpdate = useCallback(
        (partial: Partial<TtsSettings>) => {
            if (!settings) {
                return;
            }
            const updated = { ...settings, ...partial };
            if (partial.providers) {
                updated.providers = { ...settings.providers, ...partial.providers };
            }
            setSettings(updated);

            // Check if provider config contains an API key change
            const providerEntries = partial.providers ? Object.values(partial.providers) : [];
            const hasApiKeyChange = providerEntries.some((p) => p && 'apiKey' in p);

            // Provider switch or API key change: save immediately to avoid race conditions
            // (compatibility check in use-tts-setup fires on store update, needs fresh main-process state)
            if ('activeProvider' in partial || hasApiKeyChange) {
                debouncedSave.cancel();
                window.api.tts.updateSettings(partial).then(async () => {
                    // Refresh provider info and recheck compatibility after API key save
                    if (hasApiKeyChange) {
                        window.api.tts.getProviders().then(setProviders);
                        useTtsStore.getState().triggerRecheck();
                    }
                    // Resolve voice for current language on provider switch
                    if ('activeProvider' in partial && updated.autoSwitchVoice) {
                        const language = contentLanguage ?? 'fr';
                        const resolved = await window.api.tts.resolveConfigForLanguage(language);
                        if (resolved) {
                            setSettings(resolved);
                        }
                    }
                });
            } else {
                debouncedSave(partial);
            }
        },
        [settings, setSettings, setProviders, debouncedSave, contentLanguage],
    );

    const handleClearCache = useCallback(async () => {
        await window.api.tts.clearCache();
        setCacheSize(0);
        message.success(t('Cache audio vidé'));
    }, []);

    if (!settings) return null;

    const activeMeta = PROVIDER_CATALOG[settings.activeProvider];

    function openDocs() {
        const url = buildDocsGuideLink('audio-and-tts', contentLanguage);
        void window.api.app.openExternal(url);
    }

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            {/* Active provider selector */}
            <Card
                size="small"
                title={t('Lecture audio')}
                extra={
                    <Button
                        type="text"
                        size="small"
                        icon={<BookOutlined />}
                        onClick={openDocs}
                        style={{ fontSize: 'var(--fs-rel-base)', paddingInline: 6 }}
                    >
                        {t('Documentation')}
                    </Button>
                }
            >
                <Field
                    label={t('Fournisseur actif')}
                    hint={t('Le service qui lira le texte à voix haute.')}
                >
                    <Select
                        style={{ width: '100%' }}
                        value={settings.activeProvider}
                        onChange={(v) => handleUpdate({ activeProvider: v })}
                        options={Object.entries(PROVIDER_CATALOG).map(([key, meta]) => ({
                            label: (
                                <span>
                                    {t(meta.label)} <LocalityTag type={meta.locality} />
                                    {meta.free && meta.locality !== 'local' && (
                                        <>
                                            {' '}
                                            <FreeTag />
                                        </>
                                    )}
                                </span>
                            ),
                            value: key,
                        }))}
                    />
                </Field>
                <Alert
                    type="info"
                    showIcon={false}
                    style={{ marginTop: 8 }}
                    title={
                        <Text type="secondary" style={{ fontSize: 'var(--fs-rel-lg)' }}>
                            {t(activeMeta.hint)}
                        </Text>
                    }
                />

                <Divider style={{ margin: '4px 0' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Switch
                        size="small"
                        checked={settings.autoSwitchVoice}
                        onChange={(v) => handleUpdate({ autoSwitchVoice: v })}
                    />
                    <div>
                        <Text style={{ fontSize: 'var(--fs-rel-3xl)' }}>
                            {t('Changer la voix automatiquement')}
                        </Text>
                        <Hint>
                            {t('Choisir automatiquement une voix adaptée à la langue du document.')}
                        </Hint>
                    </div>
                </div>
            </Card>

            {/* Active provider config */}
            <Card
                size="small"
                title={
                    <span>
                        {t(activeMeta.label)} <LocalityTag type={activeMeta.locality} />
                        {activeMeta.free && activeMeta.locality !== 'local' && (
                            <>
                                {' '}
                                <FreeTag />
                            </>
                        )}
                    </span>
                }
                extra={
                    <Button
                        size="small"
                        icon={<SoundOutlined />}
                        loading={previewing}
                        onClick={handlePreview}
                    >
                        {t('Tester la voix')}
                    </Button>
                }
            >
                <ActiveProviderConfig settings={settings} onUpdate={handleUpdate} />
            </Card>

            {/* Highlight & playback */}
            <Card size="small">
                <Space orientation="vertical" style={{ width: '100%' }} size="small">
                    <Field
                        label={t('Mode de surlignage')}
                        hint={t(
                            'Choisissez comment le texte est mis en évidence pendant la lecture.',
                        )}
                    >
                        <Radio.Group
                            value={settings.highlightMode}
                            onChange={(e) => handleUpdate({ highlightMode: e.target.value })}
                        >
                            <Radio value="sentence">{t('Phrase')}</Radio>
                            <Radio value="paragraph">{t('Paragraphe')}</Radio>
                        </Radio.Group>
                    </Field>
                    <Divider style={{ margin: '4px 0' }} />
                    <Field label={t('Vitesse de lecture: {{rate}}x', { rate: settings.rate ?? 1 })}>
                        <Slider
                            min={0.5}
                            max={2}
                            step={0.1}
                            value={settings.rate ?? 1}
                            onChange={(v) => handleUpdate({ rate: v })}
                        />
                    </Field>
                    <Divider style={{ margin: '4px 0' }} />
                    <Field
                        label={t('Pause entre les segments: {{gap}}s', {
                            gap: ((settings.segmentGapMs ?? SEGMENT_GAP_MS) / 1000).toFixed(1),
                        })}
                        hint={t('Durée de la pause entre chaque phrase ou paragraphe lu.')}
                    >
                        <Slider
                            min={0}
                            max={2000}
                            step={50}
                            value={settings.segmentGapMs ?? SEGMENT_GAP_MS}
                            onChange={(v) => handleUpdate({ segmentGapMs: v })}
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
                            <Text style={{ fontSize: 'var(--fs-rel-3xl)' }}>
                                {t('Lecture automatique')}
                            </Text>
                            <Hint>
                                {t(
                                    "Démarrer la lecture automatiquement à l'ouverture d'un document.",
                                )}
                            </Hint>
                        </div>
                    </div>
                </Space>
            </Card>

            {/* Enhanced reading */}
            <Card size="small" title={t('Lecture améliorée')}>
                <Space orientation="vertical" style={{ width: '100%' }} size="small">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Switch
                            size="small"
                            checked={settings.readIntroduction}
                            onChange={(v) => handleUpdate({ readIntroduction: v })}
                        />
                        <div>
                            <Text style={{ fontSize: 'var(--fs-rel-3xl)' }}>
                                {t("Lire l'introduction")}
                            </Text>
                            <Hint>
                                {t(
                                    'Annonce le titre, la date et le lieu avant de commencer la lecture.',
                                )}
                            </Hint>
                        </div>
                    </div>
                    <Divider style={{ margin: '4px 0' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Switch
                            size="small"
                            checked={settings.announceSegmentNumbers}
                            onChange={(v) => handleUpdate({ announceSegmentNumbers: v })}
                        />
                        <div>
                            <Text style={{ fontSize: 'var(--fs-rel-3xl)' }}>
                                {t('Annoncer les numéros')}
                            </Text>
                            <Hint>
                                {t(
                                    'Annonce le numéro du verset ou du paragraphe avant de le lire.',
                                )}
                            </Hint>
                        </div>
                    </div>
                    <Divider style={{ margin: '4px 0' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Switch
                            size="small"
                            checked={settings.bibleReadEntireBook}
                            onChange={(v) => handleUpdate({ bibleReadEntireBook: v })}
                        />
                        <div>
                            <Text style={{ fontSize: 'var(--fs-rel-3xl)' }}>
                                {t('Lire tout le livre (Bible)')}
                            </Text>
                            <Hint>
                                {t(
                                    'Continue automatiquement au chapitre suivant après avoir terminé.',
                                )}
                            </Hint>
                        </div>
                    </div>
                    <Divider style={{ margin: '4px 0' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Switch
                            size="small"
                            checked={settings.autoScrollToHighlight}
                            onChange={(v) => handleUpdate({ autoScrollToHighlight: v })}
                        />
                        <div>
                            <Text style={{ fontSize: 'var(--fs-rel-3xl)' }}>
                                {t('Défiler automatiquement')}
                            </Text>
                            <Hint>
                                {t(
                                    'Fait défiler la page pour toujours voir le texte en cours de lecture.',
                                )}
                            </Hint>
                        </div>
                    </div>
                </Space>
            </Card>

            {/* Cache */}
            <Card size="small">
                <Field
                    label={t('Cache audio')}
                    hint={t('Les lectures passées sont conservées pour une relecture plus rapide.')}
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
                            title={t('Utilisé')}
                            value={formatBytes(cacheSize, t)}
                            valueStyle={{ fontSize: 'var(--fs-base)' }}
                        />
                        <Statistic
                            title={t('Limite')}
                            value={`${settings.cacheMaxSizeMb} ${t('Mo')}`}
                            valueStyle={{ fontSize: 'var(--fs-base)' }}
                        />
                        <Button size="small" danger onClick={handleClearCache}>
                            {t('Vider')}
                        </Button>
                    </div>
                </Field>
                <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 'var(--fs-rel-lg)' }}>
                        {t('Taille maximale du cache')}
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
