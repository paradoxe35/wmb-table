import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Button, Input, Modal, Popconfirm, Progress, Spin, Tag, message, Typography } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useModalVisible } from '@renderer/hooks';
import { useAppStore, useSermonStore } from '@renderer/stores';
import { LANGUAGE_EVENT } from '@renderer/utils/events';
import type { LanguageDownloadProgress } from '@shared/types';
import { simpleRegExp, strNormalize } from '@renderer/utils/searchable';

const { Text } = Typography;

type LanguageItem = {
    code: string;
    language: string;
    enLanguage: string;
    installed: boolean;
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
    const displayName =
        lang.language !== lang.enLanguage ? `${lang.language} (${lang.enLanguage})` : lang.language;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderBottom: '1px solid #f0f0f0',
                cursor: lang.installed && !isActive ? 'pointer' : 'default',
                background: isActive ? 'rgba(24, 143, 255, 0.06)' : undefined,
                transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
                if (lang.installed && !isActive) {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
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
                            Actif
                        </Tag>
                    )}
                    {lang.installed && !isActive && (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    )}
                </div>
                <Text type="secondary" style={{ fontSize: '0.85em' }}>
                    {lang.sermonsCount} sermons
                    {lang.installed
                        ? ` — ${formatSize(lang.sizeOnDisk)}`
                        : ` — ${formatSize(lang.filesize)}`}
                </Text>
            </div>
            <div
                style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}
            >
                {lang.installed ? (
                    <Popconfirm
                        title="Supprimer cette langue ?"
                        description="Les données de cette langue seront supprimées du disque."
                        onConfirm={onDelete}
                        okText="Supprimer"
                        cancelText="Annuler"
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                ) : isDownloading ? (
                    <Progress type="circle" size={28} percent={downloadPercent} />
                ) : (
                    <Button size="small" icon={<DownloadOutlined />} onClick={onInstall}>
                        Télécharger
                    </Button>
                )}
            </div>
        </div>
    );
}

export default function LanguageManagerModal() {
    const { visible, hide, setVisible } = useModalVisible();
    const [languages, setLanguages] = useState<LanguageItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const setActiveLanguage = useAppStore((s) => s.setActiveLanguage);
    const setSermons = useSermonStore((s) => s.setSermons);
    const [, startTransition] = useTransition();

    const refresh = useCallback(() => {
        setLoading(true);
        Promise.all([window.api.languages.getInstalled(), window.api.languages.getAvailable()])
            .then(([inst, avail]) => {
                const installedCodes = new Set(inst.map((i) => i.code));
                const merged: LanguageItem[] = [];

                for (const lang of inst) {
                    merged.push({
                        code: lang.code,
                        language: lang.language,
                        enLanguage: lang.enLanguage,
                        installed: true,
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
                            sermonsCount: lang.sermonsAvailable,
                            sizeOnDisk: 0,
                            filesize: lang.filesize,
                        });
                    }
                }

                setLanguages(merged);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
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
        window.addEventListener(LANGUAGE_EVENT.openLanguageManager, show);
        const unsubPush = window.api.on.openLanguageManager(show);
        return () => {
            window.removeEventListener(LANGUAGE_EVENT.openLanguageManager, show);
            unsubPush();
        };
    }, [setVisible]);

    // Auto-open only when no languages installed or no active language persisted
    useEffect(() => {
        Promise.all([window.api.languages.getInstalled(), window.api.app.getActiveLanguage()]).then(
            ([inst, activeLang]) => {
                if (inst.length === 0 || !activeLang) {
                    setVisible(true);
                }
            },
        );
    }, [setVisible]);

    useEffect(() => {
        if (visible) {
            refresh();
            setSearchQuery('');
        }
    }, [visible, refresh]);

    useEffect(() => {
        const unsub1 = window.api.on.languageDownloadProgress((p: LanguageDownloadProgress) => {
            setDownloadProgress((prev) => ({ ...prev, [p.langCode]: p.percentage }));
        });
        const unsub2 = window.api.on.languageInstalled(({ langCode }: { langCode: string }) => {
            setDownloadProgress((prev) => {
                const next = { ...prev };
                delete next[langCode];
                return next;
            });
            refresh();
            message.success('Langue téléchargée avec succès');
        });
        return () => {
            unsub1();
            unsub2();
        };
    }, [refresh]);

    const setTabs = useSermonStore((s) => s.setTabs);
    const setLoaded = useAppStore((s) => s.setLoaded);

    const handleSelectLanguage = async (langCode: string) => {
        try {
            // Save current tabs for the old language before switching
            const previousLang = activeLanguage;
            if (previousLang) {
                const currentTabs = useSermonStore.getState().tabs;
                await window.api.documents.saveTabs(previousLang, currentTabs);
            }

            setActiveLanguage(langCode);
            await window.api.app.setActiveLanguage(langCode);
            const [sermons, tabs] = await Promise.all([
                window.api.documents.getTitles(langCode),
                window.api.documents.getTabs(langCode),
            ]);
            startTransition(() => {
                setSermons(sermons);
                setTabs(tabs?.length ? tabs : []);
                setLoaded(true);
            });
            hide();
        } catch (err) {
            console.error('[LanguageManager] Failed to select language:', err);
            message.error('Échec de la sélection de la langue');
        }
    };

    const handleInstall = (langCode: string) => {
        setDownloadProgress((prev) => ({ ...prev, [langCode]: 0 }));
        window.api.languages.install(langCode);
    };

    const handleDelete = async (langCode: string) => {
        await window.api.languages.delete(langCode);
        if (activeLanguage === langCode) {
            const remaining = await window.api.languages.getInstalled();
            if (remaining.length > 0) {
                await handleSelectLanguage(remaining[0].code);
            } else {
                setActiveLanguage(null);
                setSermons([]);
            }
        }
        refresh();
        message.success('Langue supprimée');
    };

    const hasInstalledLanguages = languages.some((l) => l.installed);
    const canClose = hasInstalledLanguages && !!activeLanguage;

    return (
        <Modal
            title="Langues"
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
                            Téléchargez une langue pour commencer
                        </div>
                    )}
                    <Input.Search
                        placeholder="Rechercher une langue..."
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
                                Aucune langue trouvée
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
                                                        fontSize: '0.8em',
                                                        padding: '8px 12px 4px',
                                                        display: 'block',
                                                    }}
                                                >
                                                    Mes langues
                                                </Text>
                                                {installedLangs.map((lang) => (
                                                    <LanguageRow
                                                        key={lang.code}
                                                        lang={lang}
                                                        isActive={lang.code === activeLanguage}
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
                                                        fontSize: '0.8em',
                                                        padding: '8px 12px 4px',
                                                        display: 'block',
                                                    }}
                                                >
                                                    Disponibles
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
