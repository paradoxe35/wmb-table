import type { SherpaCatalogEntry } from './sherpa-catalog';
import { parseSherpaAsset } from './sherpa-catalog-parser';

/**
 * Reads the model list out of the sherpa-onnx release, which is the only machine-readable
 * list upstream publishes: every TTS model is an asset on one release, so the asset list is
 * the model list.
 *
 * Deliberately free of Electron so the catalog build script can call this very function. A
 * rebuilt bundled catalog then cannot disagree with what the app discovers at runtime.
 */

const RELEASE_ASSETS_URL =
    'https://api.github.com/repos/k2-fsa/sherpa-onnx/releases/130612623/assets';
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const REQUEST_TIMEOUT_MS = 15_000;

interface ReleaseAsset {
    name: string;
    size: number;
    browser_download_url: string;
}

async function fetchAssetPage(page: number): Promise<ReleaseAsset[]> {
    const response = await fetch(`${RELEASE_ASSETS_URL}?per_page=${PAGE_SIZE}&page=${page}`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'wmb-table' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) throw new Error(`GitHub responded ${response.status}`);

    const assets = (await response.json()) as ReleaseAsset[];
    return Array.isArray(assets) ? assets : [];
}

export async function fetchSherpaReleaseEntries(): Promise<SherpaCatalogEntry[]> {
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
