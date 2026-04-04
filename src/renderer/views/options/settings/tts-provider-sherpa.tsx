import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, List, message, Progress, Select, Space, Tag, Typography } from 'antd';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores';
import { useTtsStore } from '@renderer/stores/tts.store';
import { LANG_LABELS_FR } from '@shared/tts.types';
import type { TtsModelDownloadProgress, TtsModelInfo, TtsProviderInfo } from '@shared/tts.types';
import { getErrorMessage } from '@renderer/utils/functions';
import { strNormalize } from '@shared/searchable';
import { DeleteBtn } from '@renderer/components/delete-btn';
import { Field, groupVoicesByLanguage, type ProviderConfigProps } from './tts-shared';

const { Text } = Typography;

function matchesLang(langCode: string | string[], target: string): boolean {
    if (Array.isArray(langCode)) return langCode.includes(target);
    return langCode === target;
}

function langCodeToString(langCode: string | string[]): string {
    return Array.isArray(langCode) ? langCode.join(', ') : langCode;
}

function langLabels(langCode: string | string[]): string[] {
    const codes = Array.isArray(langCode) ? langCode : [langCode];
    return codes.map((c) => LANG_LABELS_FR[c] ?? c);
}

function translateLangLabel(label: string, t: (key: string) => string): string {
    return label === 'Multilingue' ? t(label) : label;
}

const QUALITY_META: Record<string, { label: string; color: string }> = {
    high: { label: 'Haute qualité', color: 'green' },
    medium: { label: 'Qualité moyenne', color: 'blue' },
    low: { label: 'Qualité légère', color: 'default' },
    fp16: { label: 'Qualité moyenne', color: 'blue' },
    fp32: { label: 'Haute qualité', color: 'green' },
    int8: { label: 'Qualité légère', color: 'default' },
};

function QualityTag({ quality }: { quality?: string }) {
    const { t } = useTranslation();
    const meta = quality ? QUALITY_META[quality] : undefined;
    if (!meta) return null;
    return (
        <Tag
            color={meta.color}
            style={{ fontSize: 'var(--fs-rel-md)', lineHeight: '16px', padding: '0 4px' }}
        >
            {t(meta.label)}
        </Tag>
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
                message.error(t('Erreur: {{error}}', { error: getErrorMessage(err) }));
            }
        },
        [cfg.model, cfg.voiceId, loadModels, onUpdate, setProviders, settings, t],
    );

    // ── Derived data ──

    const installed = useMemo(() => models.filter((m) => m.installed), [models]);
    const allVoices = info?.voices ?? [];
    const hasActiveDownload = downloads.size > 0;

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
                const codes = Array.isArray(m.langCode) ? m.langCode : [m.langCode];
                const allLabels = codes.map((c) => LANG_LABELS_FR[c] ?? '').join(' ');
                const haystack = strNormalize(
                    `${m.voiceName} ${m.langLabel} ${allLabels} ${m.langName ?? ''} ${langCodeToString(m.langCode)} ${m.engine ?? ''} ${m.quality ?? ''}`,
                );
                return terms.every((term) => haystack.includes(term));
            })
            .sort((a, b) => {
                if (a.installed !== b.installed) return a.installed ? -1 : 1;
                return (a.filesizeMb ?? Infinity) - (b.filesizeMb ?? Infinity);
            });
    }, [models, search]);

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
                        lang: translateLangLabel(suggestedModel.langLabel, t),
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

            {/* 2. Voice selector (when voices installed) */}
            {allVoices.length > 0 && (
                <Field label={t('Voix active')}>
                    <Select
                        style={{ width: '100%' }}
                        value={cfg.voiceId ?? allVoices[0]?.id}
                        showSearch
                        optionFilterProp="label"
                        onChange={(v) => {
                            onUpdate({
                                providers: {
                                    ...settings.providers,
                                    sherpa: {
                                        ...settings.providers.sherpa,
                                        voiceId: v,
                                        model: v.split(':')[0] || undefined,
                                    },
                                },
                            });
                        }}
                        options={groupVoicesByLanguage(
                            allVoices,
                            contentLanguage ?? undefined,
                            installed,
                        )}
                    />
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
                                        <Text type="secondary">
                                            ({translateLangLabel(m.langLabel, t)})
                                        </Text>
                                        {m.engine && (
                                            <Text
                                                type="secondary"
                                                style={{ fontSize: 'var(--fs-rel-xl)' }}
                                            >
                                                {' '}
                                                · {m.engine}
                                            </Text>
                                        )}
                                        {m.filesizeMb != null && (
                                            <Text
                                                type="secondary"
                                                style={{ fontSize: 'var(--fs-rel-xl)' }}
                                            >
                                                {' '}
                                                · ~{Math.round(m.filesizeMb)} {t('Mo')}
                                            </Text>
                                        )}{' '}
                                        <QualityTag quality={m.quality} />
                                    </Text>
                                    {Array.isArray(m.langCode) && m.langCode.length > 1 && (
                                        <div>
                                            <Text
                                                type="secondary"
                                                style={{ fontSize: 'var(--fs-rel-lg)' }}
                                            >
                                                {t('Langues')}: {langLabels(m.langCode).join(', ')}
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
                                        {translateLangLabel(m.langLabel, t)}
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
                                            {m.engine && ` · ${m.engine}`}
                                            {m.filesizeMb != null &&
                                                ` · ~${Math.round(m.filesizeMb)} ${t('Mo')}`}
                                        </Text>{' '}
                                        <QualityTag quality={m.quality} />
                                        {Array.isArray(m.langCode) && m.langCode.length > 1 && (
                                            <div style={{ marginTop: 2 }}>
                                                <Text
                                                    type="secondary"
                                                    style={{ fontSize: 'var(--fs-rel-3xl)' }}
                                                >
                                                    {t('Langues')}:{' '}
                                                    {langLabels(m.langCode).join(', ')}
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
