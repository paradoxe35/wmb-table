import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Modal, Progress, Spin, Tag, message, Typography } from 'antd';
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
                borderBottom: '1px solid var(--ant-color-border)',
                cursor: lang.installed && !isActive ? 'pointer' : 'default',
                background: isActive
                    ? 'var(--ant-color-primary-bg)'
                    : lang.installed
                      ? undefined
                      : 'var(--ant-color-bg-layout)',
                borderRadius: 4,
                transition: 'background 0.15s',
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
                        <Tag color="green" style={{ margin: 0 }}>
                            Téléchargé
                        </Tag>
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
                    <Button danger size="small" icon={<DeleteOutlined />} onClick={onDelete} />
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
    const wasEmptyRef = useRef(false);

    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const setActiveLanguage = useAppStore((s) => s.setActiveLanguage);
    const setSermons = useSermonStore((s) => s.setSermons);

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
        if (!searchQuery.trim()) return languages;
        const re = simpleRegExp(searchQuery);
        return languages.filter(
            (l) =>
                re.test(strNormalize(l.language)) ||
                re.test(strNormalize(l.enLanguage)) ||
                re.test(strNormalize(l.code)),
        );
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
    }, []);

    // Auto-open when no languages installed
    useEffect(() => {
        window.api.languages.getInstalled().then((inst) => {
            if (inst.length === 0) {
                wasEmptyRef.current = true;
                setVisible(true);
            }
        });
    }, []);

    // Keep modal open when activeLanguage is null
    useEffect(() => {
        if (!activeLanguage) setVisible(true);
    }, [activeLanguage]);

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

            if (wasEmptyRef.current || !useAppStore.getState().activeLanguage) {
                wasEmptyRef.current = false;
                handleSelectLanguage(langCode);
            }
        });
        return () => {
            unsub1();
            unsub2();
        };
    }, [refresh]);

    const handleSelectLanguage = async (langCode: string) => {
        setActiveLanguage(langCode);
        await window.api.app.setActiveLanguage(langCode);
        const sermons = await window.api.documents.getTitles(langCode);
        setSermons(sermons);
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
            mask={canClose ? undefined : { closable: false }}
            footer={null}
            width={480}
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
                            filteredLanguages.map((lang) => (
                                <LanguageRow
                                    key={lang.code}
                                    lang={lang}
                                    isActive={lang.code === activeLanguage}
                                    isDownloading={downloadProgress[lang.code] != null}
                                    downloadPercent={downloadProgress[lang.code] ?? 0}
                                    onSelect={() => handleSelectLanguage(lang.code)}
                                    onInstall={() => handleInstall(lang.code)}
                                    onDelete={() => handleDelete(lang.code)}
                                />
                            ))
                        )}
                    </div>
                </>
            )}
        </Modal>
    );
}
