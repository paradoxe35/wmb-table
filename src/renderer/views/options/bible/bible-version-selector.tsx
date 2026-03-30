import { Button, Progress, Space, Tag, Tooltip, Typography } from 'antd';
import { CheckCircleOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useBibleVersions } from '@renderer/hooks/use-bible-versions';

export function BibleVersionSelector() {
    const { t } = useTranslation();
    const {
        versions,
        activeVersion,
        installed,
        downloadable,
        downloadProgress,
        handleSwitch,
        handleDownload,
    } = useBibleVersions();

    if (versions.length <= 1 && installed.length === 1) return null;
    if (versions.length === 0) return null;

    return (
        <div className="bible-version-bar">
            <Space wrap size="small" style={{ alignItems: 'center' }}>
                <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-rel-xl)' }}>
                    {t('Version:')}
                </Typography.Text>

                {installed.map((v) => {
                    const isActive = activeVersion === v.abbreviation;
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

                {downloadable.map((v) => {
                    const progress = downloadProgress[v.abbreviation];
                    const isDownloading = progress != null;

                    if (isDownloading) {
                        return (
                            <Tag
                                key={v.abbreviation}
                                color="processing"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                                {v.name}
                                <Progress
                                    type="circle"
                                    size={14}
                                    percent={progress}
                                    showInfo={false}
                                />
                            </Tag>
                        );
                    }

                    return (
                        <Tooltip
                            key={v.abbreviation}
                            title={t('Télécharger {{name}}', { name: v.name })}
                        >
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
