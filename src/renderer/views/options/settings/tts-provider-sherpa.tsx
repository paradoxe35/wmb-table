import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Button,
    Input,
    List,
    message,
    Progress,
    Select,
    Space,
    Tag,
    Tooltip,
    Typography,
} from 'antd';
import { DownloadOutlined, SearchOutlined, SoundOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores';
import { useTtsStore } from '@renderer/stores/tts.store';
import { intlLanguageName, LANG_LABELS_FR } from '@shared/tts.types';
import type {
    TtsModelDownloadProgress,
    TtsModelInfo,
    TtsModelPrecision,
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

function matchesLang(langCode: string[], target: string): boolean {
    return langCode.includes(target);
}

/**
 * Model languages are stored as codes and named at render time, so the list reads in the
 * interface language rather than the language the catalog happened to be written in.
 */
function useLanguageNames() {
    const uiLanguage = useResolvedUiLanguage();
    const { t } = useTranslation();

    const nameOf = useCallback(
        (code: string) => intlLanguageName(code, uiLanguage) ?? LANG_LABELS_FR[code] ?? code,
        [uiLanguage],
    );

    const labelOf = useCallback(
        (langCode: string[]) =>
            langCode.length > 1 ? t('Multilingue') : (nameOf(langCode[0]) ?? ''),
        [nameOf, t],
    );

    return { nameOf, labelOf };
}

function speakerIndexOf(voice: TtsVoice): number {
    return Number(voice.id.split(':')[1] ?? 0);
}

const TAG_STYLE = { fontSize: 'var(--fs-rel-md)', lineHeight: '16px', padding: '0 4px' };

/** How the voice was trained. Nothing here describes how the file was stored. */
const QUALITY_META: Record<TtsVoiceQuality, { label: string; color: string }> = {
    high: { label: 'Haute qualité', color: 'green' },
    medium: { label: 'Qualité moyenne', color: 'blue' },
    low: { label: 'Qualité légère', color: 'default' },
    x_low: { label: 'Qualité minimale', color: 'default' },
};

/**
 * Lighter builds of one and the same voice, named after what the reader gains rather than
 * after the way the weights are stored. `fp32` is the plain full build and gets no tag.
 */
const PRECISION_META: Partial<Record<TtsModelPrecision, { label: string; hint: string }>> = {
    fp16: {
        label: 'Version compacte',
        hint: 'Téléchargement plus léger et lecture plus rapide, pour une voix quasi identique.',
    },
    int8: {
        label: 'Version très compacte',
        hint: 'Le téléchargement le plus léger et la lecture la plus rapide, avec une voix un peu moins nette.',
    },
};

function qualityMeta(model: TtsModelInfo) {
    return model.quality ? QUALITY_META[model.quality] : undefined;
}

function precisionMeta(model: TtsModelInfo) {
    return model.precision ? PRECISION_META[model.precision] : undefined;
}

/** The words shown on a model's tags, so searching matches what the reader actually sees. */
function tagLabels(model: TtsModelInfo, t: (key: string) => string): string {
    return [qualityMeta(model)?.label, precisionMeta(model)?.label]
        .filter((label) => label !== undefined)
        .map((label) => t(label))
        .join(' ');
}

function ModelTags({ model }: { model: TtsModelInfo }) {
    const { t } = useTranslation();
    const quality = qualityMeta(model);
    const precision = precisionMeta(model);

    return (
        <>
            {quality && (
                <Tag color={quality.color} style={TAG_STYLE}>
                    {t(quality.label)}
                </Tag>
            )}
            {precision && (
                <Tooltip title={t(precision.hint)}>
                    <Tag style={TAG_STYLE}>{t(precision.label)}</Tag>
                </Tooltip>
            )}
        </>
    );
}

const BROWSE_PAGE_SIZE = 10;
const MIN_QUALITY_SIZE_MB = 30;
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
    const { nameOf, labelOf } = useLanguageNames();
    const cfg = settings.providers.sherpa;
    const setProviders = useTtsStore((s) => s.setProviders);
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const langCode = contentLanguage?.split('-')[0].toLowerCase() ?? '';

    const [models, setModels] = useState<TtsModelInfo[]>([]);
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
                message.error(t('Erreur: {{error}}', { error: p.error }));
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
                if (cfg.model === modelName || cfg.voiceId?.startsWith(`${modelName}:`)) {
                    onUpdate({
                        providers: {
                            ...settings.providers,
                            sherpa: {
                                ...settings.providers.sherpa,
                                model: cfg.model === modelName ? undefined : cfg.model,
                                voiceId: cfg.voiceId?.startsWith(`${modelName}:`)
                                    ? undefined
                                    : cfg.voiceId,
                            },
                        },
                    });
                }
            } catch (err) {
                message.error(t('Erreur: {{error}}', { error: t(getErrorMessage(err)) }));
            }
        },
        [cfg.model, cfg.voiceId, loadModels, onUpdate, setProviders, settings, t],
    );

    // ── Derived data ──

    const installed = useMemo(() => models.filter((m) => m.installed), [models]);
    const allVoices = useMemo(() => info?.voices ?? [], [info]);
    const hasActiveDownload = downloads.size > 0;

    // ── Voice selection: pick the voice pack, then the speaker inside it ──

    const activeModel = cfg.voiceId?.split(':')[0] ?? installed[0]?.modelName ?? '';

    const modelVoices = useMemo(
        () => allVoices.filter((v) => v.id.startsWith(`${activeModel}:`)),
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
                        model: voiceId.split(':')[0] || undefined,
                    },
                },
            });
        },
        [onUpdate, settings.providers],
    );

    // Best available model for content language: prefer quality (≥30MB), fallback to largest
    // Skip if the language already has an installed model
    const suggestedModel = useMemo(() => {
        const hasInstalled = models.some((m) => matchesLang(m.langCode, langCode) && m.installed);
        if (hasInstalled) return undefined;

        const candidates = models.filter((m) => matchesLang(m.langCode, langCode) && !m.installed);
        if (candidates.length === 0) return undefined;

        const quality = candidates
            .filter((m) => (m.filesizeMb ?? 0) >= MIN_QUALITY_SIZE_MB)
            .sort((a, b) => (a.filesizeMb ?? 0) - (b.filesizeMb ?? 0));
        if (quality.length > 0) return quality[0];

        // Only small models available — pick the largest one
        return candidates.sort((a, b) => (b.filesizeMb ?? 0) - (a.filesizeMb ?? 0))[0];
    }, [models, langCode]);

    // Browse: accent-insensitive search, sorted by installed first then lightest
    const browseResults = useMemo(() => {
        if (!search) return [];

        const terms = strNormalize(search).split(/\s+/).filter(Boolean);
        return models
            .filter((m) => {
                const names = m.langCode.map(nameOf).join(' ');
                const haystack = strNormalize(
                    `${m.voiceName} ${names} ${m.langCode.join(' ')} ${tagLabels(m, t)}`,
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
                            onChange={(modelName) => selectVoice(`${modelName}:0`)}
                            options={installed.map((m) => ({
                                value: m.modelName,
                                label: [
                                    m.voiceName,
                                    labelOf(m.langCode),
                                    precisionMeta(m)?.label && t(precisionMeta(m)!.label),
                                ]
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
                                        {m.filesizeMb != null && (
                                            <Text
                                                type="secondary"
                                                style={{ fontSize: 'var(--fs-rel-xl)' }}
                                            >
                                                {' '}
                                                · ~{Math.round(m.filesizeMb)} {t('Mo')}
                                            </Text>
                                        )}{' '}
                                        <ModelTags model={m} />
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
                                            {m.voiceName}
                                            {m.filesizeMb != null &&
                                                ` · ~${Math.round(m.filesizeMb)} ${t('Mo')}`}
                                        </Text>{' '}
                                        <ModelTags model={m} />
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
