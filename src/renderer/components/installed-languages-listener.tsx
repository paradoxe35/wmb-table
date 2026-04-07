import { useCallback, useEffect, useRef } from 'react';
import { useInstalledLanguagesStore } from '@renderer/stores/installed-languages.store';
import { LANGUAGE_EVENT } from '@renderer/utils/events';

const STARTUP_UPDATE_CHECK_DELAY_MS = 5_000;
const BACKGROUND_UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Global listener that keeps the installed-languages store in sync.
 * Renders nothing — place it once alongside UpdateNotifier and SyncListener.
 */
export default function InstalledLanguagesListener() {
    const refresh = useInstalledLanguagesStore((s) => s.refresh);
    const backgroundRefreshInFlightRef = useRef(false);

    const refreshInBackground = useCallback(async () => {
        if (backgroundRefreshInFlightRef.current) {
            return;
        }

        backgroundRefreshInFlightRef.current = true;
        try {
            await refresh({ checkForUpdates: true });
        } finally {
            backgroundRefreshInFlightRef.current = false;
        }
    }, [refresh]);

    // Initial population
    useEffect(() => {
        void refresh();
    }, [refresh]);

    // Background freshness checks: delayed startup, window focus, and long interval.
    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void refreshInBackground();
        }, STARTUP_UPDATE_CHECK_DELAY_MS);

        const intervalId = window.setInterval(() => {
            void refreshInBackground();
        }, BACKGROUND_UPDATE_CHECK_INTERVAL_MS);

        const onFocus = () => {
            void refreshInBackground();
        };

        window.addEventListener('focus', onFocus);

        return () => {
            window.clearTimeout(timeoutId);
            window.clearInterval(intervalId);
            window.removeEventListener('focus', onFocus);
        };
    }, [refreshInBackground]);

    // Stay in sync whenever the catalog changes (install / delete / update)
    useEffect(() => {
        const onCatalogChanged = () => {
            void refresh();
        };

        window.addEventListener(LANGUAGE_EVENT.catalogChanged, onCatalogChanged);
        return () => window.removeEventListener(LANGUAGE_EVENT.catalogChanged, onCatalogChanged);
    }, [refresh]);

    return null;
}
