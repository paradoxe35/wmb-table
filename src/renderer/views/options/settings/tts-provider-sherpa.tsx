import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, List, message, Progress, Select, Space, Tag, Typography } from 'antd';
import { DownloadOutlined, SearchOutlined, SoundOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores';
import { useTtsStore } from '@renderer/stores/tts.store';
import { languageLabel, normalizeLanguageCode, voiceLanguageCode } from '@shared/tts.types';
import { pickSuggestedModel } from '@shared/sherpa-suggestion';
import {
    isSherpaVoiceOf,
    sherpaVoiceId,
    sherpaVoiceModel,
    sherpaVoiceSpeaker,
} from '@shared/sherpa-voice-id';
import type {
    TtsModelDownloadProgress,
    TtsModelInfo,
    TtsProviderInfo,
    TtsVoiceQuality,
} from '@shared/tts.types';
import { useResolvedUiLanguage } from '@renderer/hooks';
import { getErrorMessage } from '@renderer/utils/functions';
import { strNormalize } from '@shared/searchable';
import { DeleteBtn } from '@renderer/components/delete-btn';
import { Field, type ProviderConfigProps } from './tts-shared';
import { ttsAudioPlayer } from '@renderer/services/tts-audio-player';
import type { TtsVoice } from '@shared/tts.types';

const { Text } = Typography;

/**
 * Languages are stored as codes and named at render time, so the list reads in the interface
 * language. A region or script is spelled out only where a language ships more than one:
 * "portugais brésilien" against "portugais européen" earns its words, "français (France)"
 * does not.
 */
function useLanguageNames(models: TtsModelInfo[]) {
    const uiLanguage = useResolvedUiLanguage();
    const { t } = useTranslation();

    const distinguishing = useMemo(() => {
        const variants = new Map<string, Set<string>>();

        for (const model of models) {
            for (const code of model.langCode) {
                const [, variant] = code.split('-');
                if (!variant) continue;

                const base = normalizeLanguageCode(code);
                variants.set(base, (variants.get(base) ?? new Set()).add(variant));
            }
        }

        return new Set([...variants].filter(([, seen]) => seen.size > 1).map(([base]) => base));
    }, [models]);

    const nameOf = useCallback(
        (code: string) => {
            const base = normalizeLanguageCode(code);
            return languageLabel(distinguishing.has(base) ? code : base, uiLanguage);
        },
        [distinguishing, uiLanguage],
    );

    const labelOf = useCallback(
        (langCode: string[]) =>
            langCode.length > 1 ? t('Multilingue') : (nameOf(langCode[0]) ?? ''),
        [nameOf, t],
    );

    return { nameOf, labelOf };
}

function speakerIndexOf(voice: TtsVoice): number {
    return sherpaVoiceSpeaker(voice.id);
}

const TAG_STYLE = { fontSize: 'var(--fs-rel-md)', lineHeight: '16px', padding: '0 4px' };

/** How the voice was trained. Nothing here describes how the file was stored. */
const QUALITY_META: Record<TtsVoiceQuality, { label: string; color: string }> = {
    high: { label: 'Haute qualité', color: 'green' },
    medium: { label: 'Qualité moyenne', color: 'blue' },
    low: { label: 'Qualité légère', color: 'default' },
    x_low: { label: 'Qualité minimale', color: 'default' },
};

function qualityMeta(model: TtsModelInfo) {
    return model.quality ? QUALITY_META[model.quality] : undefined;
}

/** The engine that speaks it and how much it weighs — what separates two builds of a voice. */
function modelDetails(model: TtsModelInfo, t: (key: string) => string): string {
    const size = model.filesizeMb != null && `~${Math.round(model.filesizeMb)} ${t('Mo')}`;
    return [model.engine, size].filter(Boolean).join(' · ');
}

/** The words on a model's tag, so searching matches what the reader actually sees. */
function qualityLabel(model: TtsModelInfo, t: (key: string) => string): string {
    const quality = qualityMeta(model);
    return quality ? t(quality.label) : '';
}

function QualityTag({ model }: { model: TtsModelInfo }) {
    const { t } = useTranslation();
    const quality = qualityMeta(model);
    if (!quality) return null;

    return (
        <Tag color={quality.color} style={TAG_STYLE}>
            {t(quality.label)}
        </Tag>
    );
}

const BROWSE_PAGE_SIZE = 10;
const INSTALLED_LIST_MAX_HEIGHT = 200;

interface SherpaConfigProps extends ProviderConfigProps {
    info?: TtsProviderInfo;
}

type DownloadState = Pick<TtsModelDownloadProgress, 'percentage' | 'phase'>;

function getDownloadPhaseLabel(
    phase: DownloadState['phase'],
    t: (key: string) => string,
): string | null {
    if (phase === 'extracting') {
        return t('Extraction');
    }

    if (phase === 'finalizing') {
        return t('Finalisation');
    }

    if (phase === 'downloading') {
        return t('Téléchargement');
    }

    return null;
}

export default function SherpaConfig({ settings, info, onUpdate }: SherpaConfigProps) {
    const { t } = useTranslation();
    const cfg = settings.providers.sherpa;
    const setProviders = useTtsStore((s) => s.setProviders);
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const langCode = contentLanguage ? voiceLanguageCode(contentLanguage) : '';

    const [models, setModels] = useState<TtsModelInfo[]>([]);
    const { nameOf, labelOf } = useLanguageNames(models);
    // Per-model download progress: modelName → percentage
    const [downloads, setDownloads] = useState<Map<string, DownloadState>>(new Map());
    const [search, setSearch] = useState('');
    const [browsePage, setBrowsePage] = useState(1);

    // ── Data loading ──

    const loadModels = useCallback(() => {
        window.api.tts
            .getProviderModels('sherpa')
            .then(setModels)
            .catch(() => {});
    }, []);

    useEffect(() => {
        loadModels();
    }, [loadModels]);

    useEffect(() => {
        return window.api.on.ttsModelDownloadProgress((p) => {
            if (p.provider !== 'sherpa' || !p.modelName) {
                return;
            }
            const model = p.modelName;

            if (p.status === 'complete') {
                setDownloads((prev) => {
                    const next = new Map(prev);
                    next.delete(model);
                    return next;
                });
                message.success(t('Voix installée'));
                loadModels();
                window.api.tts.getProviders().then(setProviders);
            } else if (p.status === 'error') {
                setDownloads((prev) => {
                    const next = new Map(prev);
                    next.delete(model);
                    return next;
                });
                message.error(t('Erreur: {{error}}', { error: t(p.error ?? '') }));
            } else {
                setDownloads((prev) => {
                    const next = new Map(prev);
                    next.set(model, {
                        percentage: p.percentage,
                        phase: p.phase,
                    });
                    return next;
                });
            }
        });
    }, [loadModels, setProviders, t]);

    // ── Actions ──

    const handleDownload = useCallback((modelName: string) => {
        setDownloads((prev) =>
            new Map(prev).set(modelName, {
                percentage: 0,
                phase: 'downloading',
            }),
        );
        void window.api.tts.downloadModel('sherpa', modelName).catch(() => {});
    }, []);

    const handleDelete = useCallback(
        async (modelName: string) => {
            try {
                await window.api.tts.deleteProviderModel('sherpa', modelName);
                message.success(t('Voix supprimée'));
                loadModels();
                window.api.tts.getProviders().then(setProviders);
                if (isSherpaVoiceOf(cfg.voiceId ?? '', modelName)) {
                    onUpdate({
                        providers: {
                            ...settings.providers,
                            sherpa: {
                                ...settings.providers.sherpa,
                                voiceId: undefined,
                                model: undefined,
                            },
                        },
                    });
                }
            } catch (err) {
                message.error(t('Erreur: {{error}}', { error: t(getErrorMessage(err)) }));
            }
        },
        [cfg.voiceId, loadModels, onUpdate, setProviders, settings, t],
    );

    // ── Derived data ──

    const installed = useMemo(() => models.filter((m) => m.installed), [models]);
    const allVoices = useMemo(() => info?.voices ?? [], [info]);
    const hasActiveDownload = downloads.size > 0;

    // ── Voice selection: pick the voice pack, then the speaker inside it ──

    const activeModel = cfg.model ?? installed[0]?.modelName ?? '';

    const modelVoices = useMemo(
        () => allVoices.filter((v) => isSherpaVoiceOf(v.id, activeModel)),
        [allVoices, activeModel],
    );

    const speakerLabel = useCallback(
        (voice: TtsVoice) =>
            voice.name || t('Voix {{number}}', { number: speakerIndexOf(voice) + 1 }),
        [t],
    );

    const [auditioning, setAuditioning] = useState<string | null>(null);

    const audition = useCallback(
        async (voiceId: string) => {
            if (auditioning) return;
            setAuditioning(voiceId);
            try {
                const language = contentLanguage ?? 'fr';
                const result = await window.api.tts.previewVoice(language, voiceId);
                ttsAudioPlayer.play(result.audioBase64, result.mimeType, settings.rate ?? 1);
            } catch (err) {
                message.error(
                    t(getErrorMessage(err, 'Erreur lors de la prévisualisation de la voix')),
                );
            } finally {
                setAuditioning(null);
            }
        },
        [auditioning, contentLanguage, settings.rate, t],
    );

    const selectVoice = useCallback(
        (voiceId: string) => {
            onUpdate({
                providers: {
                    ...settings.providers,
                    sherpa: {
                        ...settings.providers.sherpa,
                        voiceId,
                        model: sherpaVoiceModel(voiceId),
                    },
                },
            });
        },
        [onUpdate, settings.providers],
    );

    const suggestedModel = useMemo(() => pickSuggestedModel(models, langCode), [models, langCode]);

    // Browse: accent-insensitive search, sorted by installed first then lightest
    const browseResults = useMemo(() => {
        if (!search) return [];

        const terms = strNormalize(search).split(/\s+/).filter(Boolean);
        return models
            .filter((m) => {
                const names = m.langCode.map(nameOf).join(' ');
                const haystack = strNormalize(
                    `${m.voiceName} ${names} ${m.langCode.join(' ')} ${m.engine ?? ''} ${qualityLabel(m, t)}`,
                );
                return terms.every((term) => haystack.includes(term));
            })
            .sort((a, b) => {
                if (a.installed !== b.installed) return a.installed ? -1 : 1;
                return (a.filesizeMb ?? Infinity) - (b.filesizeMb ?? Infinity);
            });
    }, [models, search, nameOf, t]);

    // ── Render helpers ──

    function renderModelAction(m: TtsModelInfo) {
        const progress = downloads.get(m.modelName);
        if (progress) {
            return (
                <Space key="progress" direction="vertical" size={0} align="end">
                    <Progress
                        percent={progress.percentage}
                        size="small"
                        style={{ width: 96, marginBottom: 0 }}
                    />
                    <Text type="secondary" style={{ fontSize: 'var(--fs-rel-sm)' }}>
                        {getDownloadPhaseLabel(progress.phase, t)}
                    </Text>
                </Space>
            );
        }
        if (m.installed) {
            return <DeleteBtn key="delete" confirm={() => handleDelete(m.modelName)} />;
        }
        return (
            <Button
                key="download"
                size="small"
                icon={<DownloadOutlined />}
                disabled={hasActiveDownload}
                onClick={() => handleDownload(m.modelName)}
            >
                {t('Télécharger')}
            </Button>
        );
    }

    // ── Render ──

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
            {/* 1. Suggested download for content language */}
            {suggestedModel && (
                <Field
                    label={t('Voix disponible — {{lang}}', {
                        lang: labelOf(suggestedModel.langCode),
                    })}
                    hint={t('Téléchargez une voix pour la langue active du document.')}
                >
                    {downloads.has(suggestedModel.modelName) ? (
                        <Progress
                            percent={downloads.get(suggestedModel.modelName)?.percentage ?? 0}
                            size="small"
                        />
                    ) : (
                        <Space size="small" align="center">
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={() => handleDownload(suggestedModel.modelName)}
                                size="small"
                                disabled={hasActiveDownload}
                            >
                                {t('Télécharger « {{name}} »', { name: suggestedModel.voiceName })}
                            </Button>
                            {suggestedModel.filesizeMb != null && (
                                <Text type="secondary" style={{ fontSize: 'var(--fs-rel-lg)' }}>
                                    ~{Math.round(suggestedModel.filesizeMb)} {t('Mo')}
                                </Text>
                            )}
                        </Space>
                    )}
                </Field>
            )}

            {/* 2. Voice pack, then the speaker inside it */}
            {installed.length > 0 && (
                <Field label={t('Voix active')}>
                    <Space orientation="vertical" style={{ width: '100%' }} size={6}>
                        <Select
                            style={{ width: '100%' }}
                            value={activeModel || undefined}
                            showSearch
                            optionFilterProp="label"
                            placeholder={t('Choisir une voix')}
                            onChange={(modelName) => selectVoice(sherpaVoiceId(modelName))}
                            options={installed.map((m) => ({
                                value: m.modelName,
                                label: [m.voiceName, labelOf(m.langCode), m.engine]
                                    .filter(Boolean)
                                    .join(' · '),
                            }))}
                        />

                        {modelVoices.length > 1 && (
                            <Space.Compact style={{ width: '100%' }}>
                                <Select
                                    style={{ width: '100%' }}
                                    value={cfg.voiceId ?? modelVoices[0]?.id}
                                    showSearch
                                    optionFilterProp="label"
                                    onChange={selectVoice}
                                    options={modelVoices.map((v) => ({
                                        value: v.id,
                                        label: speakerLabel(v),
                                    }))}
                                />
                                <Button
                                    icon={<SoundOutlined />}
                                    loading={auditioning !== null}
                                    onClick={() => void audition(cfg.voiceId ?? modelVoices[0]?.id)}
                                >
                                    {t('Écouter')}
                                </Button>
                            </Space.Compact>
                        )}

                        {modelVoices.length > 1 && (
                            <Text type="secondary" style={{ fontSize: 'var(--fs-rel-lg)' }}>
                                {t('{{count}} voix dans ce pack', { count: modelVoices.length })}
                            </Text>
                        )}
                    </Space>
                </Field>
            )}

            {/* 3. Installed voices with delete */}
            {installed.length > 0 && (
                <Field label={t('Voix installées ({{count}})', { count: installed.length })}>
                    <div style={{ maxHeight: INSTALLED_LIST_MAX_HEIGHT, overflowY: 'auto' }}>
                        {installed.map((m) => (
                            <div
                                key={m.modelName}
                                style={{
                                    display: 'flex',
                                    alignItems: 'start',
                                    justifyContent: 'space-between',
                                    padding: '4px 0',
                                }}
                            >
                                <div>
                                    <Text style={{ fontSize: 'var(--fs-rel-3xl)' }}>
                                        {m.voiceName}{' '}
                                        <Text type="secondary">({labelOf(m.langCode)})</Text>
                                        <Text
                                            type="secondary"
                                            style={{ fontSize: 'var(--fs-rel-xl)' }}
                                        >
                                            {' '}
                                            · {modelDetails(m, t)}
                                        </Text>{' '}
                                        <QualityTag model={m} />
                                    </Text>
                                    {m.langCode.length > 1 && (
                                        <div>
                                            <Text
                                                type="secondary"
                                                style={{ fontSize: 'var(--fs-rel-lg)' }}
                                            >
                                                {t('Langues')}: {m.langCode.map(nameOf).join(', ')}
                                            </Text>
                                        </div>
                                    )}
                                </div>
                                <DeleteBtn confirm={() => handleDelete(m.modelName)} />
                            </div>
                        ))}
                    </div>
                </Field>
            )}

            {/* 4. Browse other languages */}
            <Field
                label={t('Ajouter une autre langue')}
                hint={t('Recherchez une langue ou un nom de voix.')}
            >
                <Input
                    prefix={<SearchOutlined />}
                    placeholder={t('Ex: arabe, portugais, swahili…')}
                    size="small"
                    allowClear
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setBrowsePage(1);
                    }}
                />
            </Field>

            {search && (
                <List
                    size="small"
                    dataSource={browseResults}
                    locale={{ emptyText: t('Aucun résultat') }}
                    pagination={{
                        current: browsePage,
                        pageSize: BROWSE_PAGE_SIZE,
                        size: 'small',
                        simple: true,
                        hideOnSinglePage: true,
                        onChange: setBrowsePage,
                    }}
                    renderItem={(m) => (
                        <List.Item actions={[renderModelAction(m)]}>
                            <List.Item.Meta
                                title={
                                    <Text style={{ fontSize: 'var(--fs-rel-3xl)' }}>
                                        {labelOf(m.langCode)}
                                        {m.installed && <Text type="success"> ✓</Text>}
                                    </Text>
                                }
                                description={
                                    <span style={{ fontSize: 'var(--fs-rel-lg)' }}>
                                        <Text
                                            type="secondary"
                                            style={{ fontSize: 'var(--fs-base)' }}
                                        >
                                            {m.voiceName} · {modelDetails(m, t)}
                                        </Text>{' '}
                                        <QualityTag model={m} />
                                        {m.langCode.length > 1 && (
                                            <div style={{ marginTop: 2 }}>
                                                <Text
                                                    type="secondary"
                                                    style={{ fontSize: 'var(--fs-rel-3xl)' }}
                                                >
                                                    {t('Langues')}:{' '}
                                                    {m.langCode.map(nameOf).join(', ')}
                                                </Text>
                                            </div>
                                        )}
                                    </span>
                                }
                            />
                        </List.Item>
                    )}
                />
            )}

            {/* Empty state */}
            {installed.length === 0 && !suggestedModel && !search && (
                <Text type="secondary" style={{ fontSize: 'var(--fs-rel-3xl)' }}>
                    {t(
                        'Aucune voix disponible pour la langue active. Utilisez la recherche ci-dessus pour trouver une voix dans une autre langue.',
                    )}
                </Text>
            )}
        </Space>
    );
}
