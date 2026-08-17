import { useTranslation } from 'react-i18next';
import { Spin, Tooltip } from 'antd';
import { CloudSyncOutlined, LoadingOutlined } from '@ant-design/icons';
import { useAppStore } from '@renderer/stores';

export default function AppStatusIndicator() {
    const { t } = useTranslation();
    const appLoaded = useAppStore((s) => s.loaded);
    const syncing = useAppStore((s) => s.syncing);
    const syncProgress = useAppStore((s) => s.syncProgress);

    if (!appLoaded) {
        return (
            <span className="app-status-indicator">
                <Tooltip title={t('Chargement des données...')}>
                    <Spin
                        indicator={<LoadingOutlined style={{ fontSize: 'var(--fs-xl)' }} spin />}
                    />
                </Tooltip>
            </span>
        );
    }

    if (!syncing && !syncProgress) {
        return null;
    }

    const hint = syncProgress
        ? t('Synchronisation... {{processed}}/{{total}}', {
              processed: syncProgress.processed,
              total: syncProgress.total,
          })
        : t('Synchronisation en cours...');

    return (
        <span className="app-status-indicator">
            <Tooltip title={hint}>
                <CloudSyncOutlined
                    className="sync-indicator"
                    style={{
                        fontSize: 'var(--fs-base)',
                        color: 'var(--ant-color-primary)',
                    }}
                />
            </Tooltip>
        </span>
    );
}
