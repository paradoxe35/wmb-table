import { useCallback, useEffect, useState } from 'react';
import { Button, Progress, Space, Tag, Typography } from 'antd';
import { CheckCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import type { BibleVersionInfo } from '@shared/types';

export function BibleVersionSelector() {
    const [versions, setVersions] = useState<BibleVersionInfo[]>([]);
    const [activeVersion, setActiveVersion] = useState<BibleVersionInfo | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

    const refresh = useCallback(() => {
        Promise.all([window.api.bible.getAllVersions(), window.api.bible.getActiveVersion()]).then(
            ([all, active]) => {
                setVersions(all);
                setActiveVersion(active);
            },
        );
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        const unsub1 = window.api.on.bibleDownloadProgress(
            (p: { abbreviation: string; percentage: number }) => {
                setDownloadProgress((prev) => ({ ...prev, [p.abbreviation]: p.percentage }));
            },
        );
        const unsub2 = window.api.on.bibleDownloaded(
            ({ abbreviation }: { abbreviation: string }) => {
                setDownloadProgress((prev) => {
                    const next = { ...prev };
                    delete next[abbreviation];
                    return next;
                });
                refresh();
            },
        );
        return () => {
            unsub1();
            unsub2();
        };
    }, [refresh]);

    const handleSwitch = useCallback(
        async (abbreviation: string) => {
            await window.api.bible.switchVersion(abbreviation);
            refresh();
            window.dispatchEvent(new Event('bible-version-changed'));
        },
        [refresh],
    );

    const handleDownload = useCallback((abbreviation: string) => {
        setDownloadProgress((prev) => ({ ...prev, [abbreviation]: 0 }));
        window.api.bible.downloadVersion(abbreviation);
    }, []);

    if (versions.length <= 1 && activeVersion) return null;
    if (versions.length === 0) return null;

    return (
        <div className="bible-version-bar">
            <Space wrap size="small">
                <Typography.Text type="secondary" style={{ fontSize: '0.85em' }}>
                    Version:
                </Typography.Text>
                {versions.map((v) => {
                    const isActive = activeVersion?.abbreviation === v.abbreviation;
                    const isDownloading = downloadProgress[v.abbreviation] != null;

                    if (!v.available && !isDownloading) {
                        return (
                            <Button
                                key={v.abbreviation}
                                size="small"
                                icon={<DownloadOutlined />}
                                onClick={() => handleDownload(v.abbreviation)}
                            >
                                {v.name}
                            </Button>
                        );
                    }

                    if (isDownloading) {
                        return (
                            <Space key={v.abbreviation} size="small">
                                <Typography.Text style={{ fontSize: '0.85em' }}>
                                    {v.name}
                                </Typography.Text>
                                <Progress
                                    type="circle"
                                    size={24}
                                    percent={downloadProgress[v.abbreviation]}
                                />
                            </Space>
                        );
                    }

                    return (
                        <Tag
                            key={v.abbreviation}
                            color={isActive ? 'blue' : 'default'}
                            style={{ cursor: isActive ? 'default' : 'pointer' }}
                            onClick={isActive ? undefined : () => handleSwitch(v.abbreviation)}
                        >
                            {isActive && <CheckCircleOutlined />} {v.name}
                        </Tag>
                    );
                })}
            </Space>
        </div>
    );
}
