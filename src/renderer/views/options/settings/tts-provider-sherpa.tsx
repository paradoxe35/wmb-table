import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, List, message, Progress, Select, Space, Typography } from 'antd';
import { DeleteOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useAppStore } from '@renderer/stores';
import { useTtsStore } from '@renderer/stores/tts.store';
import type { TtsModelInfo, TtsProviderInfo } from '@shared/tts.types';
import {
    Field,
    groupVoicesByLanguage,
    providerUpdate,
    type ProviderConfigProps,
} from './tts-shared';

const { Text } = Typography;

const BROWSE_PAGE_SIZE = 10;

interface SherpaConfigProps extends ProviderConfigProps {
    info?: TtsProviderInfo;
}

export default function SherpaConfig({ settings, info, onUpdate }: SherpaConfigProps) {
    const cfg = settings.providers.sherpa;
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const langCode = activeLanguage?.split('-')[0].toLowerCase() ?? '';

    const [models, setModels] = useState<TtsModelInfo[]>([]);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [downloadPct, setDownloadPct] = useState(0);
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
            if (p.provider !== 'sherpa') return;
            setDownloadPct(p.percentage);
            if (p.status === 'complete') {
                message.success('Voix installée');
                setDownloading(null);
                setDownloadPct(0);
                loadModels();
                window.api.tts.getProviders().then(useTtsStore.getState().setProviders);
            }
            if (p.status === 'error') {
                message.error(`Erreur: ${p.error}`);
                setDownloading(null);
                setDownloadPct(0);
            }
        });
    }, [loadModels]);

    // ── Actions ──

    const handleDownload = useCallback((modelName: string) => {
        setDownloading(modelName);
        setDownloadPct(0);
        window.api.tts.downloadModel('sherpa', modelName).catch((err) => {
            message.error(`Erreur: ${err.message}`);
            setDownloading(null);
        });
    }, []);

    const handleDelete = useCallback(
        async (modelName: string) => {
            try {
                await window.api.tts.deleteProviderModel('sherpa', modelName);
                message.success('Voix supprimée');
                loadModels();
                window.api.tts.getProviders().then(useTtsStore.getState().setProviders);
                if (cfg.model === modelName) {
                    onUpdate(providerUpdate(settings, 'sherpa', 'model', undefined));
                }
            } catch (err) {
                message.error(`Erreur: ${(err as Error).message}`);
            }
        },
        [loadModels, cfg.model, settings, onUpdate],
    );

    // ── Derived data ──

    const installed = useMemo(() => models.filter((m) => m.installed), [models]);
    const allVoices = info?.voices ?? [];

    // Best available model for active language (not yet installed), lightest first
    const suggestedModel = useMemo(() => {
        const candidates = models
            .filter((m) => m.langCode === langCode && !m.installed)
            .sort((a, b) => (a.filesizeMb ?? Infinity) - (b.filesizeMb ?? Infinity));
        return candidates[0];
    }, [models, langCode]);

    // Browse: search-filtered, sorted by installed first then lightest
    const browseResults = useMemo(() => {
        if (!search) return [];
        const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
        return models
            .filter((m) => {
                const haystack =
                    `${m.voiceName} ${m.langLabel} ${m.langName ?? ''} ${m.langCode} ${m.engine ?? ''}`.toLowerCase();
                return terms.every((t) => haystack.includes(t));
            })
            .sort((a, b) => {
                if (a.installed !== b.installed) return a.installed ? -1 : 1;
                return (a.filesizeMb ?? Infinity) - (b.filesizeMb ?? Infinity);
            });
    }, [models, search]);

    // Auto-select voice matching active language
    useEffect(() => {
        if (!langCode || allVoices.length === 0) return;
        const langVoices = allVoices.filter((v) => v.languageCodes.some((lc) => lc === langCode));
        if (langVoices.length === 0) return;
        const currentVoice = cfg.voiceId;
        const currentMatchesLang = currentVoice && langVoices.some((v) => v.id === currentVoice);
        if (!currentMatchesLang) {
            onUpdate(providerUpdate(settings, 'sherpa', 'voiceId', langVoices[0].id));
        }
    }, [langCode]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Render ──

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="small">
            {/* 1. Suggested download for active language */}
            {suggestedModel && (
                <Field
                    label={`Voix disponible — ${suggestedModel.langLabel}`}
                    hint="Téléchargez une voix pour la langue active du document."
                >
                    {downloading === suggestedModel.modelName ? (
                        <Progress percent={downloadPct} size="small" />
                    ) : (
                        <Space size="small" align="center">
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={() => handleDownload(suggestedModel.modelName)}
                                size="small"
                            >
                                Télécharger « {suggestedModel.voiceName} »
                            </Button>
                            {suggestedModel.filesizeMb != null && (
                                <Text type="secondary" style={{ fontSize: '0.8em' }}>
                                    ~{Math.round(suggestedModel.filesizeMb)} Mo
                                </Text>
                            )}
                        </Space>
                    )}
                </Field>
            )}

            {/* 2. Voice selector (when voices installed) */}
            {allVoices.length > 0 && (
                <Field label="Voix active">
                    <Select
                        style={{ width: '100%' }}
                        value={cfg.voiceId ?? allVoices[0]?.id}
                        showSearch
                        optionFilterProp="label"
                        onChange={(v) => onUpdate(providerUpdate(settings, 'sherpa', 'voiceId', v))}
                        options={groupVoicesByLanguage(allVoices)}
                    />
                </Field>
            )}

            {/* 3. Installed voices with delete */}
            {installed.length > 0 && (
                <Field label={`Voix installées (${installed.length})`}>
                    <div>
                        {installed.map((m) => (
                            <div
                                key={m.modelName}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '3px 0',
                                }}
                            >
                                <Text style={{ fontSize: '0.9em' }}>
                                    {m.voiceName} <Text type="secondary">({m.langLabel})</Text>
                                    {m.filesizeMb != null && (
                                        <Text type="secondary" style={{ fontSize: '0.85em' }}>
                                            {' '}
                                            · ~{Math.round(m.filesizeMb)} Mo
                                        </Text>
                                    )}
                                </Text>
                                <Button
                                    type="text"
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => handleDelete(m.modelName)}
                                />
                            </div>
                        ))}
                    </div>
                </Field>
            )}

            {/* 4. Browse other languages */}
            <Field label="Ajouter une autre langue" hint="Recherchez une langue ou un nom de voix.">
                <Input
                    prefix={<SearchOutlined />}
                    placeholder="Ex: arabe, portugais, swahili…"
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
                    locale={{ emptyText: 'Aucun résultat' }}
                    pagination={{
                        current: browsePage,
                        pageSize: BROWSE_PAGE_SIZE,
                        size: 'small',
                        simple: true,
                        hideOnSinglePage: true,
                        onChange: setBrowsePage,
                    }}
                    renderItem={(m) => (
                        <List.Item
                            actions={[
                                downloading === m.modelName ? (
                                    <Progress
                                        key="progress"
                                        percent={downloadPct}
                                        size="small"
                                        style={{ width: 80 }}
                                    />
                                ) : m.installed ? (
                                    <Button
                                        key="delete"
                                        type="text"
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleDelete(m.modelName)}
                                    />
                                ) : (
                                    <Button
                                        key="download"
                                        size="small"
                                        icon={<DownloadOutlined />}
                                        onClick={() => handleDownload(m.modelName)}
                                    >
                                        Télécharger
                                    </Button>
                                ),
                            ]}
                        >
                            <List.Item.Meta
                                title={
                                    <Text style={{ fontSize: '0.9em' }}>
                                        {m.langLabel}
                                        {m.installed && <Text type="success"> ✓</Text>}
                                    </Text>
                                }
                                description={
                                    <Text type="secondary" style={{ fontSize: '0.8em' }}>
                                        {m.voiceName}
                                        {m.engine && ` · ${m.engine}`}
                                        {m.filesizeMb != null &&
                                            ` · ~${Math.round(m.filesizeMb)} Mo`}
                                    </Text>
                                }
                            />
                        </List.Item>
                    )}
                />
            )}

            {/* Empty state */}
            {installed.length === 0 && !suggestedModel && !search && (
                <Text type="secondary" style={{ fontSize: '0.9em' }}>
                    Aucune voix disponible pour la langue active. Utilisez la recherche ci-dessus
                    pour trouver une voix dans une autre langue.
                </Text>
            )}
        </Space>
    );
}
