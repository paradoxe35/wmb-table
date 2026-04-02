import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { notification, Button } from 'antd';
import { useAppStore } from '@renderer/stores';
import { buildDownloadPageLink } from '@shared/constants';

export const UPDATE_TAB_EVENT = 'go-to-update-tab';

/**
 * Global listener for update notifications.
 * Shows a toast when a new update is available or downloaded,
 * with a button to navigate to the update settings tab.
 */
export default function UpdateNotifier() {
    const { t } = useTranslation();
    const showOptions = useAppStore((s) => s.showOptions);
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const shownRef = useRef<Set<string>>(new Set());

    const goToUpdateTab = () => {
        showOptions('settings');
        window.dispatchEvent(new Event(UPDATE_TAB_EVENT));
    };

    useEffect(() => {
        return window.api.on.notifyForNewUpdate((data) => {
            if (data.type === 'hasUpdate' && !shownRef.current.has('hasUpdate')) {
                shownRef.current.add('hasUpdate');
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

            if (data.type === 'downloaded' && !shownRef.current.has('downloaded')) {
                shownRef.current.add('downloaded');
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
        });
    }, [contentLanguage, showOptions, t]);

    return null;
}
