import { useTranslation } from 'react-i18next';
import { Spin, Tooltip } from 'antd';
import { CloudSyncOutlined, LoadingOutlined } from '@ant-design/icons';
import { useAppStore } from '@renderer/stores';

function toPercent(processed: number, total: number): number {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((processed / total) * 100));
}

export default function AppStatusIndicator() {
    const { t } = useTranslation();
    const appLoaded = useAppStore((s) => s.loaded);
    const syncing = useAppStore((s) => s.syncing);
    const syncProgress = useAppStore((s) => s.syncProgress);

    if (!appLoaded) {
        return (
            <Tooltip title={t('Chargement des données...')}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 'var(--fs-xl)' }} spin />} />
            </Tooltip>
        );
    }

    if (!syncing && !syncProgress) {
        return null;
    }

    const hint = syncProgress
        ? t('Synchronisation en cours... {{percent}}%', {
              percent: toPercent(syncProgress.processed, syncProgress.total),
          })
        : t('Synchronisation en cours...');

    return (
        <Tooltip title={hint}>
            <CloudSyncOutlined
                style={{
                    fontSize: 'var(--fs-base)',
                    color: 'var(--ant-color-primary)',
                    opacity: 0.7,
                }}
            />
        </Tooltip>
    );
}
