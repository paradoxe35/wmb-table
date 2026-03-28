import { join } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import {
    Index,
    TextAnalyzerBuilder,
    TokenizerStatic,
    FilterStatic,
} from '@pngwasi/node-tantivy-binding';

interface MetaJsonSchema {
    name: string;
    type: string;
    options: {
        indexed?: boolean;
        indexing?: {
            tokenizer: string;
        };
    };
}

const indexCache = new Map<string, Index>();
const indexCapabilitiesCache = new Map<string, IndexCapabilities>();

export const ORDER_ASC = 0 as const;
export const MAX_SERMON_SEARCH_HITS = 50000;
export const MAX_ORDERED_LINE_SCAN = 100000;
export const INITIAL_SERMON_SEARCH_HITS = 2000;

export interface IndexCapabilities {
    paragraphIndexIndexed: boolean;
    sermonDateIndexed: boolean;
    translationIdIndexed: boolean;
    paragraphScopedQueriesSupported: boolean;
}

const DEFAULT_INDEX_CAPABILITIES: IndexCapabilities = {
    paragraphIndexIndexed: false,
    sermonDateIndexed: true,
    translationIdIndexed: true,
    paragraphScopedQueriesSupported: false,
};

export function extractNumeric(dict: Record<string, unknown[]>, field: string): number {
    const vals = dict[field];
    if (!vals || vals.length === 0) return 0;
    return Number(vals[0]);
}

export function extractString(dict: Record<string, unknown[]>, field: string): string {
    const vals = dict[field];
    if (!vals || vals.length === 0) return '';
    return String(vals[0]);
}

function buildStemTokenizer(
    tokenizerName: string,
    langEnglishTitle: string | null,
): ReturnType<TextAnalyzerBuilder['build']> | null {
    if (!tokenizerName.endsWith('_stem') || !langEnglishTitle) return null;
    return new TextAnalyzerBuilder(TokenizerStatic.simple())
        .filter(FilterStatic.lowercase())
        .filter(FilterStatic.stemmer(langEnglishTitle.toLowerCase()))
        .build();
}

function readMetaSchema(metaJsonPath: string): MetaJsonSchema[] {
    const raw = readFileSync(metaJsonPath, 'utf-8');
    const meta = JSON.parse(raw) as { schema: MetaJsonSchema[] };
    return meta.schema;
}

function buildIndexCapabilities(schema: MetaJsonSchema[]): IndexCapabilities {
    const paragraphIndex = schema.find((field) => field.name === 'paragraph_index');
    const sermonDate = schema.find((field) => field.name === 'sermon_date');
    const translationId = schema.find((field) => field.name === 'translation_id');

    const paragraphIndexIndexed = paragraphIndex?.options?.indexed === true;
    const sermonDateIndexed = sermonDate?.options?.indexed !== false;
    const translationIdIndexed = translationId?.options?.indexed !== false;

    return {
        paragraphIndexIndexed,
        sermonDateIndexed,
        translationIdIndexed,
        paragraphScopedQueriesSupported:
            paragraphIndexIndexed && sermonDateIndexed && translationIdIndexed,
    };
}

function registerTokenizersForIndex(
    index: Index,
    metaSchema: MetaJsonSchema[],
    langEnglishTitle: string | null,
): void {
    const registered = new Set<string>();
    for (const field of metaSchema) {
        const tokenizerName = field.options?.indexing?.tokenizer;
        if (!tokenizerName || tokenizerName === 'default' || registered.has(tokenizerName)) {
            continue;
        }

        const tokenizer = buildStemTokenizer(tokenizerName, langEnglishTitle);
        if (tokenizer) {
            index.registerTokenizer(tokenizerName, tokenizer);
            registered.add(tokenizerName);
        }
    }
}

export function getTextFieldNames(index: Index): string[] {
    const schema = index.schema;
    const names: string[] = [];
    for (const name of schema.fieldNames()) {
        if (schema.getFieldType(name) === 0) {
            names.push(name);
        }
    }
    return names;
}

export function getIndex(langCode: string): Index {
    const idx = indexCache.get(langCode);
    if (!idx) throw new Error(`No Tantivy index loaded for language "${langCode}"`);
    return idx;
}

export function getIndexCapabilities(langCode: string): IndexCapabilities {
    return indexCapabilitiesCache.get(langCode) ?? DEFAULT_INDEX_CAPABILITIES;
}

export function initializeIndexes(indexesDir: string, langTitles: Record<string, string>): void {
    if (!existsSync(indexesDir)) {
        console.warn(`[tantivy-worker] Index directory not found: ${indexesDir}`);
        return;
    }

    let entries: string[];
    try {
        entries = readdirSync(indexesDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name);
    } catch (error) {
        console.warn('[tantivy-worker] Failed to read index directory:', error);
        return;
    }

    for (const langCode of entries) {
        const indexPath = join(indexesDir, langCode);
        const metaPath = join(indexPath, 'meta.json');
        if (!existsSync(metaPath)) {
            console.warn(`[tantivy-worker] Skipping index "${langCode}": missing meta.json`);
            continue;
        }

        try {
            openIndexEntry(indexesDir, langCode, langTitles[langCode] ?? null);
        } catch (error) {
            console.warn(`[tantivy-worker] Failed to open index "${langCode}":`, error);
        }
    }
}

export function openIndexEntry(
    indexesDir: string,
    langCode: string,
    langEnglishTitle: string | null,
): void {
    const indexPath = join(indexesDir, langCode);
    const metaPath = join(indexPath, 'meta.json');
    if (!existsSync(metaPath)) {
        throw new Error(`Missing meta.json for language "${langCode}"`);
    }

    const metaSchema = readMetaSchema(metaPath);
    const index = Index.open(indexPath);
    registerTokenizersForIndex(index, metaSchema, langEnglishTitle);
    index.configReader('OnCommit');
    indexCache.set(langCode, index);
    const capabilities = buildIndexCapabilities(metaSchema);
    indexCapabilitiesCache.set(langCode, capabilities);
    if (!capabilities.paragraphScopedQueriesSupported) {
        console.warn(
            `[tantivy-worker] Index "${langCode}" uses legacy schema: paragraph_index is not indexed`,
        );
    }
}

export function closeAllIndexes(): void {
    indexCache.clear();
    indexCapabilitiesCache.clear();
}

export function getInstalledLanguages(): string[] {
    return Array.from(indexCache.keys());
}
