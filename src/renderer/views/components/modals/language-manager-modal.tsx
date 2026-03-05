import { useEffect, useState } from 'react';
import { Button, List, Modal, Progress, Spin, message, Typography } from 'antd';
import { DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useModalVisible } from '@renderer/hooks';
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

    const refresh = () => {
        setLoading(true);
        Promise.all([
            window.api.languages.getInstalled() as Promise<InstalledLanguage[]>,
            window.api.languages.getAvailable() as Promise<DownloadableLanguage[]>,
        ])
            .then(([inst, avail]) => {
                setInstalled(inst);
                setAvailable(avail.filter((a) => !a.installed));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const show = () => setVisible(true);
        window.addEventListener(LANGUAGE_EVENT.openLanguageManager, show);
        return () => window.removeEventListener(LANGUAGE_EVENT.openLanguageManager, show);
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
            message.success(`Langue installée avec succès`);
        });
        return () => {
            unsub1();
            unsub2();
        };
    }, []);

    const handleInstall = (langCode: string) => {
        setDownloadProgress((prev) => ({ ...prev, [langCode]: 0 }));
        window.api.languages.install(langCode);
    };

    const handleDelete = async (langCode: string) => {
        await window.api.languages.delete(langCode);
        refresh();
        message.success('Langue supprimée');
    };

    return (
        <Modal title="Gérer les langues" open={visible} onCancel={hide} footer={null} width={500}>
            {loading ? (
                <div className="flex flex-center" style={{ padding: '2rem' }}>
                    <Spin />
                </div>
            ) : (
                <>
                    <Text strong>Langues installées</Text>
                    <List
                        size="small"
                        dataSource={installed}
                        locale={{ emptyText: 'Aucune langue installée' }}
                        renderItem={(lang) => (
                            <List.Item
                                actions={[
                                    <Button
                                        key="del"
                                        danger
                                        size="small"
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleDelete(lang.code)}
                                        disabled={installed.length <= 1}
                                    />,
                                ]}
                            >
                                <List.Item.Meta
                                    title={lang.language}
                                    description={`${lang.sermonsCount} sermons — ${formatSize(lang.sizeOnDisk)}`}
                                />
                            </List.Item>
                        )}
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
                                                    Installer
                                                </Button>
                                            ),
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={lang.language}
                                            description={`${lang.sermonsAvailable} sermons — ${formatSize(lang.filesize)}`}
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
