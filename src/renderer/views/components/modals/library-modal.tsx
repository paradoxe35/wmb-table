import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button, Input, Modal, Popconfirm, Progress, Spin, Tag, message, Typography } from 'antd';
import {
    CheckCircleOutlined,
    DeleteOutlined,
    DownloadOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
    fetchLanguageWorkspace,
    useApplyLanguageWorkspace,
    useModalVisible,
} from '@renderer/hooks';
import { useAppStore, useDocumentTabsStore, useSermonStore } from '@renderer/stores';
import { LANGUAGE_EVENT } from '@renderer/utils/events';
import type { LanguageDownloadProgress, LanguageInstalledEvent } from '@shared/types';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';
import { useTtsStore } from '@renderer/stores/tts.store';
import { stopAllTtsPlayback } from '@renderer/services/tts-audio-player';

const { Text } = Typography;

type LanguageItem = {
    code: string;
    language: string;
    enLanguage: string;
    installed: boolean;
    updateAvailable: boolean;
    sermonsCount: number;
    sizeOnDisk: number;
    filesize: number;
};

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function LanguageRow({
    lang,
    isActive,
    isDownloading,
    downloadPercent,
    onSelect,
    onInstall,
    onDelete,
}: {
    lang: LanguageItem;
    isActive: boolean;
    isDownloading: boolean;
    downloadPercent: number;
    onSelect: () => void;
    onInstall: () => void;
    onDelete: () => void;
}) {
    const { t } = useTranslation();
    const displayName =
        lang.language !== lang.enLanguage ? `${lang.language} (${lang.enLanguage})` : lang.language;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderBottom: '1px solid var(--ant-color-border-secondary)',
                cursor: lang.installed && !isActive ? 'pointer' : 'default',
                background: isActive ? 'var(--ant-color-primary-bg)' : undefined,
                transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
                if (lang.installed && !isActive) {
                    e.currentTarget.style.background = 'var(--ant-color-fill-quaternary)';
                }
            }}
            onMouseLeave={(e) => {
                if (lang.installed && !isActive) {
                    e.currentTarget.style.background = '';
                }
            }}
            onClick={lang.installed && !isActive ? onSelect : undefined}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{displayName}</span>
                    {isActive && (
                        <Tag color="blue" icon={<CheckCircleOutlined />} style={{ margin: 0 }}>
                            {t('Actif')}
                        </Tag>
                    )}
                    {lang.updateAvailable && (
                        <Tag color="gold" style={{ margin: 0 }}>
                            {t('Mise à jour disponible')}
                        </Tag>
                    )}
                    {lang.installed && !isActive && (
                        <CheckCircleOutlined style={{ color: 'var(--ant-color-success)' }} />
                    )}
                </div>
                <Text type="secondary" style={{ fontSize: 'var(--fs-rel-xl)' }}>
                    {lang.sermonsCount} {t('sermons')}
                    {lang.installed
                        ? ` — ${formatSize(lang.sizeOnDisk)}`
                        : ` — ${formatSize(lang.filesize)}`}
                </Text>
            </div>
            <div
                style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}
            >
                {isDownloading ? (
                    <Progress type="circle" size={28} percent={downloadPercent} />
                ) : lang.installed && lang.updateAvailable ? (
                    <Button
                        size="small"
                        type="primary"
                        icon={<ReloadOutlined />}
                        onClick={onInstall}
                    >
                        {t('Mettre à jour')}
                    </Button>
                ) : lang.installed ? (
                    <Popconfirm
                        title={t('Supprimer cette langue ?')}
                        description={t('Les données de cette langue seront supprimées du disque.')}
                        onConfirm={onDelete}
                        okText={t('Supprimer')}
                        cancelText={t('Annuler')}
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                ) : (
                    <Button size="small" icon={<DownloadOutlined />} onClick={onInstall}>
                        {t('Télécharger')}
                    </Button>
                )}
            </div>
        </div>
    );
}

export default function LibraryModal() {
    const { t } = useTranslation();
    const { visible, hide, setVisible } = useModalVisible();
    const [languages, setLanguages] = useState<LanguageItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const applyLanguageWorkspace = useApplyLanguageWorkspace();
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const setContentLanguage = useAppStore((s) => s.setContentLanguage);
    const setActiveBibleVersion = useAppStore((s) => s.setActiveBibleVersion);
    const tabs = useDocumentTabsStore((s) => s.tabs);
    const resetTts = useTtsStore((s) => s.reset);
    const [, startTransition] = useTransition();
    const refreshGenerationRef = useRef(0);

    const refresh = useCallback((options?: { force?: boolean }) => {
        const generation = ++refreshGenerationRef.current;

        setLoading(true);
        Promise.all([
            window.api.languages.getInstalled({
                checkForUpdates: true,
                force: options?.force,
            }),
            window.api.languages.getAvailable(),
        ])
            .then(([inst, avail]) => {
                if (generation !== refreshGenerationRef.current) {
                    return;
                }

                const installedCodes = new Set(inst.map((i) => i.code));
                const merged: LanguageItem[] = [];

                for (const lang of inst) {
                    merged.push({
                        code: lang.code,
                        language: lang.language,
                        enLanguage: lang.enLanguage,
                        installed: true,
                        updateAvailable: lang.updateAvailable,
                        sermonsCount: lang.sermonsCount,
                        sizeOnDisk: lang.sizeOnDisk,
                        filesize: 0,
                    });
                }

                for (const lang of avail) {
                    if (!installedCodes.has(lang.code)) {
                        merged.push({
                            code: lang.code,
                            language: lang.language,
                            enLanguage: lang.enLanguage,
                            installed: false,
                            updateAvailable: false,
                            sermonsCount: lang.sermonsAvailable,
                            sizeOnDisk: 0,
                            filesize: lang.filesize,
                        });
                    }
                }

                setLanguages(merged);
            })
            .catch(() => {})
            .finally(() => {
                if (generation === refreshGenerationRef.current) {
                    setLoading(false);
                }
            });
    }, []);

    const filteredLanguages = useMemo(() => {
        let list = languages;
        if (searchQuery.trim()) {
            const re = simpleRegExp(searchQuery);
            list = list.filter(
                (l) =>
                    re.test(strNormalize(l.language)) ||
                    re.test(strNormalize(l.enLanguage)) ||
                    re.test(strNormalize(l.code)),
            );
        }
        const sorted = [...list].sort((a, b) => a.language.localeCompare(b.language));
        const installed = sorted.filter((l) => l.installed);
        const available = sorted.filter((l) => !l.installed);
        return [...installed, ...available];
    }, [languages, searchQuery]);

    // Listen for open events (DOM event + IPC push from menu)
    useEffect(() => {
        const show = () => setVisible(true);
        window.addEventListener(LANGUAGE_EVENT.openLibrary, show);
        const unsubPush = window.api.on.openLibrary(show);
        return () => {
            window.removeEventListener(LANGUAGE_EVENT.openLibrary, show);
            unsubPush();
        };
    }, [setVisible]);

    // Auto-open only when no languages installed or no content language persisted
    useEffect(() => {
        let cancelled = false;

        Promise.all([
            window.api.languages.getInstalled(),
            window.api.app.getContentLanguage(),
        ]).then(([inst, contentLang]) => {
            if (!cancelled && (inst.length === 0 || !contentLang)) {
                setVisible(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [setVisible]);

    useEffect(() => {
        if (visible) {
            refresh({ force: true });
            setSearchQuery('');
        }
    }, [visible, refresh]);

    const setTabs = useDocumentTabsStore((s) => s.setTabs);
    const setLoaded = useAppStore((s) => s.setLoaded);
    const setSermons = useSermonStore((s) => s.setSermons);
    const notifyLibraryChanged = useCallback(() => {
        window.dispatchEvent(new Event(LANGUAGE_EVENT.catalogChanged));
    }, []);

    const loadLanguageWorkspace = useCallback(
        async (
            langCode: string,
            options?: {
                saveTabsForLanguage?: string | null;
                persistContentLanguage?: boolean;
                closeModal?: boolean;
            },
        ) => {
            if (options?.saveTabsForLanguage) {
                await window.api.documents.saveTabs(options.saveTabsForLanguage, tabs);
            }

            stopAllTtsPlayback();
            resetTts();

            if (options?.persistContentLanguage !== false) {
                await window.api.app.setContentLanguage(langCode);
            }

            const workspace = await fetchLanguageWorkspace(langCode);
            startTransition(() => {
                applyLanguageWorkspace(langCode, workspace);
                setLoaded(true);
            });

            if (options?.closeModal) {
                hide();
            }
        },
        [applyLanguageWorkspace, hide, resetTts, setLoaded, tabs],
    );

    useEffect(() => {
        const unsub1 = window.api.on.languageDownloadProgress((p: LanguageDownloadProgress) => {
            setDownloadProgress((prev) => ({ ...prev, [p.langCode]: p.percentage }));
        });
        const unsub2 = window.api.on.languageInstalled(
            async ({ langCode, action }: LanguageInstalledEvent) => {
                setDownloadProgress((prev) => {
                    const next = { ...prev };
                    delete next[langCode];
                    return next;
                });

                if (action === 'updated' && contentLanguage === langCode) {
                    try {
                        await loadLanguageWorkspace(langCode, {
                            saveTabsForLanguage: langCode,
                            persistContentLanguage: false,
                        });
                    } catch (err) {
                        console.error('[LibraryModal] Failed to reload updated language:', err);
                        message.error(t('Échec de la sélection de la langue'));
                    }
                }

                refresh();
                notifyLibraryChanged();
                message.success(
                    action === 'updated'
                        ? t('Langue mise à jour avec succès')
                        : t('Langue téléchargée avec succès'),
                );
            },
        );
        return () => {
            unsub1();
            unsub2();
        };
    }, [contentLanguage, loadLanguageWorkspace, notifyLibraryChanged, refresh, t]);

    const handleSelectLanguage = useCallback(
        async (langCode: string, options?: { preserveCurrentTabs?: boolean }) => {
            try {
                const previousLang = contentLanguage;
                await loadLanguageWorkspace(langCode, {
                    saveTabsForLanguage:
                        previousLang && options?.preserveCurrentTabs !== false
                            ? previousLang
                            : null,
                    closeModal: true,
                });
            } catch (err) {
                console.error('[LibraryModal] Failed to select language:', err);
                message.error(t('Échec de la sélection de la langue'));
            }
        },
        [contentLanguage, loadLanguageWorkspace, t],
    );

    const handleInstall = (langCode: string) => {
        setDownloadProgress((prev) => ({ ...prev, [langCode]: 0 }));
        window.api.languages.install(langCode);
    };

    const handleDelete = async (langCode: string) => {
        await window.api.languages.delete(langCode);
        if (contentLanguage === langCode) {
            const remaining = await window.api.languages.getInstalled();
            if (remaining.length > 0) {
                await handleSelectLanguage(remaining[0].code, { preserveCurrentTabs: false });
            } else {
                stopAllTtsPlayback();
                resetTts();

                await window.api.app.setContentLanguage(null);
                setContentLanguage(null);
                setActiveBibleVersion(null);
                setSermons([]);
                setTabs([]);
            }
        }
        refresh();
        notifyLibraryChanged();
        message.success(t('Langue supprimée'));
    };

    const hasInstalledLanguages = languages.some((l) => l.installed);
    const canClose = hasInstalledLanguages && !!contentLanguage;

    return (
        <Modal
            title={t('Bibliothèque')}
            open={visible}
            onCancel={canClose ? hide : undefined}
            closable={canClose}
            mask={{ closable: canClose }}
            keyboard={canClose}
            footer={null}
            width={480}
            style={{ border: 'none', outline: 'none' }}
        >
            {loading ? (
                <div className="flex flex-center" style={{ padding: '2rem' }}>
                    <Spin />
                </div>
            ) : (
                <>
                    {!hasInstalledLanguages && (
                        <div
                            style={{
                                padding: '4px 0 12px',
                                color: 'var(--ant-color-text-secondary)',
                            }}
                        >
                            {t('Téléchargez une langue pour commencer')}
                        </div>
                    )}
                    <Input.Search
                        placeholder={t('Rechercher une langue...')}
                        allowClear
                        onChange={(e) => setSearchQuery(e.target.value)}
                        value={searchQuery}
                        style={{ marginBottom: 12 }}
                    />
                    <div style={{ maxHeight: 400, overflow: 'auto' }}>
                        {filteredLanguages.length === 0 ? (
                            <div
                                style={{
                                    padding: '16px 0',
                                    textAlign: 'center',
                                    color: 'var(--ant-color-text-secondary)',
                                }}
                            >
                                {t('Aucune langue trouvée')}
                            </div>
                        ) : (
                            (() => {
                                const installedLangs = filteredLanguages.filter((l) => l.installed);
                                const availableLangs = filteredLanguages.filter(
                                    (l) => !l.installed,
                                );
                                return (
                                    <>
                                        {installedLangs.length > 0 && (
                                            <>
                                                <Text
                                                    type="secondary"
                                                    style={{
                                                        fontSize: 'var(--fs-rel-lg)',
                                                        padding: '8px 12px 4px',
                                                        display: 'block',
                                                    }}
                                                >
                                                    {t('Mes langues')}
                                                </Text>
                                                {installedLangs.map((lang) => (
                                                    <LanguageRow
                                                        key={lang.code}
                                                        lang={lang}
                                                        isActive={lang.code === contentLanguage}
                                                        isDownloading={
                                                            downloadProgress[lang.code] != null
                                                        }
                                                        downloadPercent={
                                                            downloadProgress[lang.code] ?? 0
                                                        }
                                                        onSelect={() =>
                                                            handleSelectLanguage(lang.code)
                                                        }
                                                        onInstall={() => handleInstall(lang.code)}
                                                        onDelete={() => handleDelete(lang.code)}
                                                    />
                                                ))}
                                            </>
                                        )}
                                        {availableLangs.length > 0 && (
                                            <>
                                                <Text
                                                    type="secondary"
                                                    style={{
                                                        fontSize: 'var(--fs-rel-lg)',
                                                        padding: '8px 12px 4px',
                                                        display: 'block',
                                                    }}
                                                >
                                                    {t('Disponibles')}
                                                </Text>
                                                {availableLangs.map((lang) => (
                                                    <LanguageRow
                                                        key={lang.code}
                                                        lang={lang}
                                                        isActive={false}
                                                        isDownloading={
                                                            downloadProgress[lang.code] != null
                                                        }
                                                        downloadPercent={
                                                            downloadProgress[lang.code] ?? 0
                                                        }
                                                        onSelect={() =>
                                                            handleSelectLanguage(lang.code)
                                                        }
                                                        onInstall={() => handleInstall(lang.code)}
                                                        onDelete={() => handleDelete(lang.code)}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </>
                                );
                            })()
                        )}
                    </div>
                </>
            )}
        </Modal>
    );
}
