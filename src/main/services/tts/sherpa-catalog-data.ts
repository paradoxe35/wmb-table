import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { voiceLanguageCode } from '@shared/tts.types';
import type { SherpaCatalogEntry } from './sherpa-catalog';
import { entrySupportsLang, isPlayableEntry } from './sherpa-catalog';
import { getRemoteCatalogEntries } from './sherpa-catalog-remote';
import { getTtsResourceDir } from '@main/lib/app-paths';

let bundled: SherpaCatalogEntry[] | null = null;
let merged: { entries: SherpaCatalogEntry[]; remoteCount: number } | null = null;

function loadBundled(): SherpaCatalogEntry[] {
    if (!bundled) {
        const filePath = join(getTtsResourceDir(), 'sherpa-catalog.json');
        bundled = JSON.parse(readFileSync(filePath, 'utf-8')) as SherpaCatalogEntry[];
    }
    return bundled;
}

/**
 * The bundled catalog carries curated metadata (speaker counts, language pairs) that cannot
 * be derived from an asset name, so it wins wherever the two overlap; the refreshed list
 * only contributes models the bundle has never heard of.
 */
function loadCatalog(): SherpaCatalogEntry[] {
    const base = loadBundled();
    const remote = getRemoteCatalogEntries();

    if (merged && merged.remoteCount === remote.length) return merged.entries;

    const known = new Set(base.map((entry) => entry.modelName));
    const entries = [...base, ...remote.filter((entry) => !known.has(entry.modelName))].filter(
        isPlayableEntry,
    );

    merged = { entries, remoteCount: remote.length };
    return entries;
}

export function getAllCatalogModels(): SherpaCatalogEntry[] {
    return loadCatalog();
}

export function findCatalogModelByModelName(modelName: string): SherpaCatalogEntry | undefined {
    return loadCatalog().find((m) => m.modelName === modelName);
}

export function findCatalogModelsByLangCode(langCode: string): SherpaCatalogEntry[] {
    const code = voiceLanguageCode(langCode);
    return loadCatalog().filter((m) => entrySupportsLang(m, code));
}
