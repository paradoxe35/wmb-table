import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { App as AntApp, Button } from 'antd';
import { useAppStore } from '@renderer/stores';
import { buildDownloadPageLink } from '@shared/constants';
import type { UpdaterNotification } from '@shared/types';

export const UPDATE_TAB_EVENT = 'go-to-update-tab';

const version = (data: UpdaterNotification) => data.updateInfo?.version ?? 'unknown';

/**
 * Global listener for update notifications.
 * Shows a toast when a new update is available or downloaded,
 * with a button to navigate to the update settings tab.
 */
export default function UpdateNotifier() {
    const { t } = useTranslation();
    // Context-aware instance: the static antd API renders outside ConfigProvider
    // and would ignore the app theme
    const { notification } = AntApp.useApp();
    const showOptions = useAppStore((s) => s.showOptions);
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const shownRef = useRef<Set<string>>(new Set());

    const goToUpdateTab = useCallback(() => {
        showOptions('settings');
        window.dispatchEvent(new Event(UPDATE_TAB_EVENT));
    }, [showOptions]);

    useEffect(() => {
        const handle = (data: UpdaterNotification) => {
            if (data.type === 'hasUpdate' && !shownRef.current.has(`hasUpdate:${version(data)}`)) {
                shownRef.current.add(`hasUpdate:${version(data)}`);
                const key = 'update-available';
                const canAuto = data.canAutoUpdate !== false;

                notification.info({
                    key,
                    message: t('Mise à jour disponible'),
                    description: data.updateInfo?.version
                        ? t('La version {{version}} est disponible.', {
                              version: data.updateInfo.version,
                          })
                        : t('Une nouvelle version est disponible.'),
                    duration: 15,
                    btn: canAuto ? (
                        <Button
                            type="primary"
                            size="small"
                            onClick={() => {
                                goToUpdateTab();
                                notification.destroy(key);
                            }}
                        >
                            {t('Voir la mise à jour')}
                        </Button>
                    ) : (
                        <Button
                            type="primary"
                            size="small"
                            onClick={() => {
                                window.api.app.openExternal(buildDownloadPageLink(contentLanguage));
                                notification.destroy(key);
                            }}
                        >
                            {t('Télécharger')}
                        </Button>
                    ),
                });
            }

            if (
                data.type === 'downloaded' &&
                !shownRef.current.has(`downloaded:${version(data)}`)
            ) {
                shownRef.current.add(`downloaded:${version(data)}`);
                const key = 'update-downloaded';
                notification.success({
                    key,
                    message: t('Mise à jour prête'),
                    description: t(
                        "La mise à jour a été téléchargée. Elle sera installée au prochain redémarrage, ou vous pouvez l'installer maintenant.",
                    ),
                    duration: 0,
                    btn: (
                        <Button
                            type="primary"
                            size="small"
                            onClick={() => {
                                window.api.app.quitAndInstallUpdate();
                            }}
                        >
                            {t('Redémarrer et installer')}
                        </Button>
                    ),
                });
            }
        };

        // A check can complete before this mounts, so read what is already known
        window.api.app.getUpdateStatus().then(handle);
        return window.api.on.notifyForNewUpdate(handle);
    }, [contentLanguage, goToUpdateTab, notification, t]);

    return null;
}
