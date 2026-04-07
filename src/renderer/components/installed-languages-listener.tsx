import { useEffect } from 'react';
import { useInstalledLanguagesStore } from '@renderer/stores/installed-languages.store';
import { LANGUAGE_EVENT } from '@renderer/utils/events';

/**
 * Global listener that keeps the installed-languages store in sync.
 * Renders nothing — place it once alongside UpdateNotifier and SyncListener.
 */
export default function InstalledLanguagesListener() {
    const refresh = useInstalledLanguagesStore((s) => s.refresh);

    // Initial population
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Stay in sync whenever the catalog changes (install / delete / update)
    useEffect(() => {
        window.addEventListener(LANGUAGE_EVENT.catalogChanged, refresh);
        return () => window.removeEventListener(LANGUAGE_EVENT.catalogChanged, refresh);
    }, [refresh]);

    return null;
}
