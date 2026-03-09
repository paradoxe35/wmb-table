import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Progress, Space, Tag, Tooltip, Typography } from 'antd';
import { CheckCircleOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import type { BibleVersionInfo } from '@shared/types';

export function BibleVersionSelector() {
    const [versions, setVersions] = useState<BibleVersionInfo[]>([]);
    const [activeVersion, setActiveVersion] = useState<BibleVersionInfo | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

    const refresh = useCallback(() => {
        Promise.all([window.api.bible.getVersions(), window.api.bible.getActiveVersion()]).then(
            ([all, active]) => {
                setVersions(all);
                setActiveVersion(active);
            },
        );
    }, []);

    // On mount: fetch remote index (discovers new versions), then refresh UI
    useEffect(() => {
        window.api.bible
            .refreshIndex()
            .then(() => refresh())
            .catch(() => refresh());
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
                // Auto-switch to the newly downloaded version
                handleSwitch(abbreviation);
            },
        );
        return () => {
            unsub1();
            unsub2();
        };
    }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const { installed, downloadable } = useMemo(() => {
        const inst: BibleVersionInfo[] = [];
        const dl: BibleVersionInfo[] = [];
        for (const v of versions) {
            if (v.available) inst.push(v);
            else dl.push(v);
        }
        return { installed: inst, downloadable: dl };
    }, [versions]);

    // Nothing to show if only one version and it's active
    if (versions.length <= 1 && activeVersion) return null;
    if (versions.length === 0) return null;

    return (
        <div className="bible-version-bar">
            <Space wrap size="small" style={{ alignItems: 'center' }}>
                <Typography.Text type="secondary" style={{ fontSize: '0.85em' }}>
                    Version:
                </Typography.Text>

                {/* Installed versions — clickable tags */}
                {installed.map((v) => {
                    const isActive = activeVersion?.abbreviation === v.abbreviation;
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

                {/* Downloadable versions — small download buttons */}
                {downloadable.map((v) => {
                    const progress = downloadProgress[v.abbreviation];
                    const isDownloading = progress != null;

                    if (isDownloading) {
                        return (
                            <Tag key={v.abbreviation} color="processing">
                                {v.name}{' '}
                                <Progress
                                    type="circle"
                                    size={16}
                                    percent={progress}
                                    showInfo={false}
                                    style={{ marginLeft: 4 }}
                                />
                            </Tag>
                        );
                    }

                    return (
                        <Tooltip key={v.abbreviation} title={`Télécharger ${v.name}`}>
                            <Button
                                size="small"
                                type="dashed"
                                icon={<CloudDownloadOutlined />}
                                onClick={() => handleDownload(v.abbreviation)}
                            >
                                {v.name}
                            </Button>
                        </Tooltip>
                    );
                })}
            </Space>
        </div>
    );
}
