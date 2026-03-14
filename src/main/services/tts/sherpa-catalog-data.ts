import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SherpaCatalogEntry } from './sherpa-catalog';
import { normalizeLangCode } from './sherpa-catalog';
import { getTtsResourceDir } from '@main/lib/app-paths';

// ── Lazy-loaded catalog (single source of truth) ──

let _catalog: SherpaCatalogEntry[] | null = null;

function loadCatalog(): SherpaCatalogEntry[] {
    if (!_catalog) {
        const filePath = join(getTtsResourceDir(), 'sherpa-catalog.json');
        _catalog = JSON.parse(readFileSync(filePath, 'utf-8')) as SherpaCatalogEntry[];
    }
    return _catalog;
}

// ── Lookup functions ──

export function getAllCatalogModels(): SherpaCatalogEntry[] {
    return loadCatalog();
}

export function findCatalogModelByModelName(modelName: string): SherpaCatalogEntry | undefined {
    return loadCatalog().find((m) => m.modelName === modelName);
}

export function findCatalogModelsByLangCode(langCode: string): SherpaCatalogEntry[] {
    const code = normalizeLangCode(langCode);
    return loadCatalog().filter((m) => normalizeLangCode(m.langCode) === code);
}
