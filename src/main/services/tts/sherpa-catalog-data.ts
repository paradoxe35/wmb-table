import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SherpaCatalogEntry } from './sherpa-catalog';
import { isPlayableEntry, withoutRedundantHalfPrecision } from './sherpa-catalog';
import { getRemoteCatalogEntries } from './sherpa-catalog-remote';
import { getTtsResourceDir } from '@main/lib/app-paths';

let bundled: SherpaCatalogEntry[] | null = null;
let known: { entries: SherpaCatalogEntry[]; remoteCount: number } | null = null;
let offered: { entries: SherpaCatalogEntry[]; remoteCount: number } | null = null;

function loadBundled(): SherpaCatalogEntry[] {
    if (!bundled) {
        const filePath = join(getTtsResourceDir(), 'sherpa-catalog.json');
        bundled = JSON.parse(readFileSync(filePath, 'utf-8')) as SherpaCatalogEntry[];
    }
    return bundled;
}

/** The bundled catalog wins wherever the two overlap; the refresh only adds what is new. */
function knownModels(): SherpaCatalogEntry[] {
    const base = loadBundled();
    const remote = getRemoteCatalogEntries();

    if (known && known.remoteCount === remote.length) return known.entries;

    const names = new Set(base.map((entry) => entry.modelName));
    const entries = [...base, ...remote.filter((entry) => !names.has(entry.modelName))];

    known = { entries, remoteCount: remote.length };
    return entries;
}

/** The models worth putting in front of a reader: those that play, once per voice. */
function offeredModels(): SherpaCatalogEntry[] {
    const remote = getRemoteCatalogEntries();
    if (offered && offered.remoteCount === remote.length) return offered.entries;

    const entries = withoutRedundantHalfPrecision(knownModels().filter(isPlayableEntry));

    offered = { entries, remoteCount: remote.length };
    return entries;
}

export function getAllCatalogModels(): SherpaCatalogEntry[] {
    return offeredModels();
}

/** Searches every model, so one already installed keeps its name once no longer offered. */
export function findCatalogModelByModelName(modelName: string): SherpaCatalogEntry | undefined {
    return knownModels().find((m) => m.modelName === modelName);
}
