import { useEffect, useRef, useState } from 'react';
import { Button, List, Modal, Progress, Spin, Tag, message, Typography } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useModalVisible } from '@renderer/hooks';
import { useAppStore, useSermonStore } from '@renderer/stores';
import { LANGUAGE_EVENT } from '@renderer/utils/events';
import type {
    InstalledLanguage,
    DownloadableLanguage,
    LanguageDownloadProgress,
} from '@shared/types';

const { Text } = Typography;

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LanguageManagerModal() {
    const { visible, hide, setVisible } = useModalVisible();
    const [installed, setInstalled] = useState<InstalledLanguage[]>([]);
    const [available, setAvailable] = useState<DownloadableLanguage[]>([]);
    const [loading, setLoading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
    const wasEmptyRef = useRef(false);

    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const setActiveLanguage = useAppStore((s) => s.setActiveLanguage);
    const setSermons = useSermonStore((s) => s.setSermons);

    const refresh = () => {
        setLoading(true);
        Promise.all([window.api.languages.getInstalled(), window.api.languages.getAvailable()])
            .then(([inst, avail]) => {
                setInstalled(inst);
                setAvailable(avail.filter((a) => !a.installed));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

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

    useEffect(() => {
        if (visible) refresh();
    }, [visible]);

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
            message.success('Langue t\u00e9l\u00e9charg\u00e9e avec succ\u00e8s');

            // If no active language yet, auto-select this one
            if (wasEmptyRef.current) {
                wasEmptyRef.current = false;
                handleSelectLanguage(langCode);
            }
        });
        return () => {
            unsub1();
            unsub2();
        };
    }, []);

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
        refresh();
        message.success('Langue supprim\u00e9e');
    };

    const noLanguages = installed.length === 0 && !loading;

    return (
        <Modal
            title="G\u00e9rer les langues"
            open={visible}
            onCancel={noLanguages ? undefined : hide}
            closable={!noLanguages}
            maskClosable={!noLanguages}
            footer={null}
            width={500}
        >
            {loading ? (
                <div className="flex flex-center" style={{ padding: '2rem' }}>
                    <Spin />
                </div>
            ) : (
                <>
                    <Text strong>Langues install\u00e9es</Text>
                    <List
                        size="small"
                        dataSource={installed}
                        locale={{ emptyText: 'Aucune langue install\u00e9e' }}
                        renderItem={(lang) => {
                            const isActive = lang.code === activeLanguage;
                            return (
                                <List.Item
                                    style={{ cursor: isActive ? 'default' : 'pointer' }}
                                    onClick={
                                        isActive ? undefined : () => handleSelectLanguage(lang.code)
                                    }
                                    actions={[
                                        isActive ? (
                                            <Tag
                                                key="active"
                                                color="green"
                                                icon={<CheckCircleOutlined />}
                                            >
                                                Actif
                                            </Tag>
                                        ) : (
                                            <Button
                                                key="select"
                                                size="small"
                                                type="link"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelectLanguage(lang.code);
                                                }}
                                            >
                                                S\u00e9lectionner
                                            </Button>
                                        ),
                                        <Button
                                            key="del"
                                            danger
                                            size="small"
                                            icon={<DeleteOutlined />}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(lang.code);
                                            }}
                                            disabled={installed.length <= 1}
                                        />,
                                    ]}
                                >
                                    <List.Item.Meta
                                        title={
                                            lang.language !== lang.enLanguage
                                                ? `${lang.language} (${lang.enLanguage})`
                                                : lang.language
                                        }
                                        description={`${lang.sermonsCount} sermons \u2014 ${formatSize(lang.sizeOnDisk)}`}
                                    />
                                </List.Item>
                            );
                        }}
                    />

                    {available.length > 0 && (
                        <>
                            <Text strong style={{ marginTop: 16, display: 'block' }}>
                                Langues disponibles
                            </Text>
                            <List
                                size="small"
                                dataSource={available}
                                renderItem={(lang) => (
                                    <List.Item
                                        actions={[
                                            downloadProgress[lang.code] != null ? (
                                                <Progress
                                                    key="progress"
                                                    type="circle"
                                                    size={30}
                                                    percent={downloadProgress[lang.code]}
                                                />
                                            ) : (
                                                <Button
                                                    key="install"
                                                    size="small"
                                                    icon={<DownloadOutlined />}
                                                    onClick={() => handleInstall(lang.code)}
                                                >
                                                    T\u00e9l\u00e9charger
                                                </Button>
                                            ),
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={
                                                lang.language !== lang.enLanguage
                                                    ? `${lang.language} (${lang.enLanguage})`
                                                    : lang.language
                                            }
                                            description={`${lang.sermonsAvailable} sermons \u2014 ${formatSize(lang.filesize)}`}
                                        />
                                    </List.Item>
                                )}
                            />
                        </>
                    )}
                </>
            )}
        </Modal>
    );
}
