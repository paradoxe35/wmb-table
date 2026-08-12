import log from 'electron-log';
import { SimpleCache } from '@main/lib/simple-cache';
import type { SherpaCatalogEntry } from './sherpa-catalog';
import { fetchSherpaReleaseEntries } from './sherpa-release';

/**
 * Keeps the bundled Sherpa catalog current without shipping a new build.
 *
 * Whatever was last fetched stays usable offline: models are never withdrawn, so a stale
 * list is only ever missing recent additions.
 */

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

const catalogCache = new SimpleCache<SherpaCatalogEntry[]>('sherpa-catalog', REFRESH_INTERVAL_MS);

let memo: SherpaCatalogEntry[] | null = null;
let refreshing: Promise<void> | null = null;

/** Models discovered upstream since the bundled catalog was built. */
export function getRemoteCatalogEntries(): SherpaCatalogEntry[] {
    memo ??= catalogCache.getStale() ?? [];
    return memo;
}

/**
 * Refreshes the cache in the background. Never throws: an offline or rate-limited app keeps
 * using the models it already knows about.
 */
export function refreshSherpaCatalog(options?: { force?: boolean }): Promise<void> {
    if (refreshing) return refreshing;
    if (!options?.force && catalogCache.get() !== null) return Promise.resolve();

    refreshing = fetchSherpaReleaseEntries()
        .then((entries) => {
            if (entries.length === 0) return;

            const previous = memo?.length ?? 0;
            catalogCache.set(entries);
            memo = entries;

            if (entries.length !== previous) {
                log.info(`Sherpa catalog refreshed: ${entries.length} models upstream`);
            }
        })
        .catch((error) => {
            log.warn('Sherpa catalog refresh failed', error);
        })
        .finally(() => {
            refreshing = null;
        });

    return refreshing;
}

export function _resetSherpaCatalogCacheForTesting(): void {
    memo = null;
    refreshing = null;
}
