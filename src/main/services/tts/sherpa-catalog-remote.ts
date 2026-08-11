import log from 'electron-log';
import { SimpleCache } from '@main/lib/simple-cache';
import type { SherpaCatalogEntry } from './sherpa-catalog';
import { parseSherpaAsset } from './sherpa-catalog-parser';

/**
 * Keeps the bundled Sherpa catalog current without shipping a new build.
 *
 * Upstream publishes every TTS model as an asset on one GitHub release, so the asset list
 * is the model list. Whatever was last fetched stays usable offline: models are never
 * withdrawn, so a stale list is only ever missing recent additions.
 */

const RELEASE_ASSETS_URL =
    'https://api.github.com/repos/k2-fsa/sherpa-onnx/releases/130612623/assets';
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

const catalogCache = new SimpleCache<SherpaCatalogEntry[]>('sherpa-catalog', REFRESH_INTERVAL_MS);

interface ReleaseAsset {
    name: string;
    size: number;
    browser_download_url: string;
}

let memo: SherpaCatalogEntry[] | null = null;
let refreshing: Promise<void> | null = null;

async function fetchAssetPage(page: number): Promise<ReleaseAsset[]> {
    const response = await fetch(`${RELEASE_ASSETS_URL}?per_page=${PAGE_SIZE}&page=${page}`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'wmb-table' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) throw new Error(`GitHub responded ${response.status}`);

    const assets = (await response.json()) as ReleaseAsset[];
    return Array.isArray(assets) ? assets : [];
}

async function fetchRemoteEntries(): Promise<SherpaCatalogEntry[]> {
    const entries: SherpaCatalogEntry[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
        const assets = await fetchAssetPage(page);
        for (const asset of assets) {
            const entry = parseSherpaAsset(asset.name, asset.size, asset.browser_download_url);
            if (entry) entries.push(entry);
        }
        if (assets.length < PAGE_SIZE) break;
    }

    return entries;
}

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

    refreshing = fetchRemoteEntries()
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
