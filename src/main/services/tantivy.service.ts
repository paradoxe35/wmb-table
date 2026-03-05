import { app } from 'electron';
import { join } from 'node:path';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import log from 'electron-log';
import type { SermonParagraph } from '@shared/types';
import {
    Index,
    Query,
    SnippetGenerator,
    TextAnalyzerBuilder,
    TokenizerStatic,
    FilterStatic,
    Order,
    type DocAddress,
    type SearchHit,
} from '@oxdev03/node-tantivy-binding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { SermonParagraph } from '@shared/types';

export interface SermonDateEntry {
    translationId: number;
    sermonDate: number;
}

export interface GroupedSearchHit {
    translationId: number;
    sermonDate: number;
    score: number;
    bestDocAddress: DocAddress;
    hitCount: number;
}

export interface SearchSermonResult {
    hits: GroupedSearchHit[];
    total: number;
}

export type { DocAddress };

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const indexCache = new Map<string, Index>();
const sermonDatesCache = new Map<string, SermonDateEntry[]>();
let indexesDir = '';

// ---------------------------------------------------------------------------
// Tokenizer builders
// ---------------------------------------------------------------------------

interface MetaJsonSchema {
    name: string;
    type: string;
    options: {
        indexing?: {
            tokenizer: string;
        };
    };
}

const TOKENIZER_BUILDERS: Record<string, () => ReturnType<TextAnalyzerBuilder['build']>> = {
    en_stem: () =>
        new TextAnalyzerBuilder(TokenizerStatic.simple())
            .filter(FilterStatic.lowercase())
            .filter(FilterStatic.stemmer('english'))
            .build(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getIndexesDir(): string {
    if (!indexesDir) {
        indexesDir = join(app.getPath('userData'), 'indexes');
    }
    return indexesDir;
}

function getIndex(langCode: string): Index {
    const idx = indexCache.get(langCode);
    if (!idx) throw new Error(`No Tantivy index loaded for language "${langCode}"`);
    return idx;
}

function extractNumeric(dict: Record<string, unknown[]>, field: string): number {
    const vals = dict[field];
    if (!vals || vals.length === 0) return 0;
    return Number(vals[0]);
}

function extractString(dict: Record<string, unknown[]>, field: string): string {
    const vals = dict[field];
    if (!vals || vals.length === 0) return '';
    return String(vals[0]);
}

function registerTokenizersForIndex(index: Index, metaJsonPath: string): void {
    const raw = readFileSync(metaJsonPath, 'utf-8');
    const meta = JSON.parse(raw) as { schema: MetaJsonSchema[] };

    const registered = new Set<string>();
    for (const field of meta.schema) {
        const tokenizerName = field.options?.indexing?.tokenizer;
        if (!tokenizerName || tokenizerName === 'default' || registered.has(tokenizerName))
            continue;

        const builder = TOKENIZER_BUILDERS[tokenizerName];
        if (builder) {
            index.registerTokenizer(tokenizerName, builder());
            registered.add(tokenizerName);
        } else {
            log.warn(
                `[tantivy] Unknown tokenizer "${tokenizerName}" in index — skipping registration`,
            );
        }
    }
}

function getTextFieldNames(index: Index): string[] {
    const schema = index.schema;
    const names: string[] = [];
    for (const name of schema.fieldNames()) {
        // FieldType.Str = 0 for text fields
        if (schema.getFieldType(name) === 0) {
            names.push(name);
        }
    }
    return names;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initializeTantivy(): void {
    const dir = getIndexesDir();
    if (!existsSync(dir)) {
        log.info(`[tantivy] Indexes directory does not exist yet: ${dir}`);
        return;
    }

    let entries: string[];
    try {
        entries = readdirSync(dir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name);
    } catch (err) {
        log.error('[tantivy] Failed to read indexes directory:', err);
        return;
    }

    for (const langCode of entries) {
        const indexPath = join(dir, langCode);
        const metaPath = join(indexPath, 'meta.json');
        if (!existsSync(metaPath)) continue;

        try {
            openIndex(langCode);
            log.info(`[tantivy] Opened index for "${langCode}"`);
        } catch (err) {
            log.error(`[tantivy] Failed to open index for "${langCode}":`, err);
        }
    }
}

export function openIndex(langCode: string): void {
    const dir = getIndexesDir();
    const indexPath = join(dir, langCode);
    const index = Index.open(indexPath);
    registerTokenizersForIndex(index, join(indexPath, 'meta.json'));
    index.configReader('OnCommit');
    indexCache.set(langCode, index);
}

export function closeAllIndexes(): void {
    indexCache.clear();
    sermonDatesCache.clear();
}

export function getInstalledLanguages(): string[] {
    return Array.from(indexCache.keys());
}

export function getSermonParagraphs(langCode: string, translationId: number): SermonParagraph[] {
    const index = getIndex(langCode);
    const schema = index.schema;
    const hasStemmed = schema.hasField('stemmed_content');

    const query = Query.termQuery(schema, 'translation_id', translationId);
    const searcher = index.searcher();
    const result = searcher.search(query, 10000, false, 'line_index', 0, Order.Asc);

    const paragraphs: SermonParagraph[] = [];
    for (const hit of result.hits) {
        const doc = searcher.doc(hit.docAddress);
        const dict = doc.toDict() as Record<string, unknown[]>;

        const paragraph: SermonParagraph = {
            lineIndex: extractNumeric(dict, 'line_index'),
            paragraphIndex: extractNumeric(dict, 'paragraph_index'),
            translationId: extractNumeric(dict, 'translation_id'),
            sermonDate: extractNumeric(dict, 'sermon_date'),
            content: extractString(dict, 'unstemmed_content'),
        };

        if (hasStemmed) {
            const stemmed = extractString(dict, 'stemmed_content');
            if (stemmed) paragraph.stemmedContent = stemmed;
        }

        paragraphs.push(paragraph);
    }

    return paragraphs;
}

export function getUniqueSermonDates(langCode: string): SermonDateEntry[] {
    const cached = sermonDatesCache.get(langCode);
    if (cached) return cached;

    const index = getIndex(langCode);
    const query = Query.allQuery();
    const searcher = index.searcher();

    // Order by translation_id to group docs by sermon
    const result = searcher.search(query, searcher.numDocs, false, 'translation_id', 0, Order.Asc);

    const entries: SermonDateEntry[] = [];
    let lastTranslationId = -1;

    for (const hit of result.hits) {
        const currentOrder = hit.order ?? -1;
        if (currentOrder === lastTranslationId) continue;
        lastTranslationId = currentOrder;

        const doc = searcher.doc(hit.docAddress);
        const dict = doc.toDict() as Record<string, unknown[]>;

        entries.push({
            translationId: extractNumeric(dict, 'translation_id'),
            sermonDate: extractNumeric(dict, 'sermon_date'),
        });
    }

    sermonDatesCache.set(langCode, entries);
    return entries;
}

export function searchSermons(
    langCode: string,
    queryText: string,
    limit: number,
    offset: number,
): SearchSermonResult {
    const index = getIndex(langCode);
    const textFields = getTextFieldNames(index);
    const query = index.parseQuery(queryText, textFields);
    const searcher = index.searcher();

    const fetchLimit = Math.min((offset + limit) * 20, 10000);
    const result = searcher.search(query, fetchLimit, true);

    // Group hits by translation_id
    const groups = new Map<
        number,
        { score: number; bestDocAddress: DocAddress; hitCount: number; sermonDate: number }
    >();

    for (const hit of result.hits) {
        const doc = searcher.doc(hit.docAddress);
        const dict = doc.toDict() as Record<string, unknown[]>;
        const translationId = extractNumeric(dict, 'translation_id');
        const score = hit.score ?? 0;

        const existing = groups.get(translationId);
        if (!existing) {
            groups.set(translationId, {
                score,
                bestDocAddress: hit.docAddress,
                hitCount: 1,
                sermonDate: extractNumeric(dict, 'sermon_date'),
            });
        } else {
            existing.hitCount++;
            if (score > existing.score) {
                existing.score = score;
                existing.bestDocAddress = hit.docAddress;
            }
        }
    }

    // Sort by score desc
    const sorted = Array.from(groups.entries())
        .map(([translationId, g]) => ({
            translationId,
            sermonDate: g.sermonDate,
            score: g.score,
            bestDocAddress: g.bestDocAddress,
            hitCount: g.hitCount,
        }))
        .sort((a, b) => b.score - a.score);

    const total = sorted.length;
    const hits = sorted.slice(offset, offset + limit);

    return { hits, total };
}

export function getSermonParagraphCount(langCode: string, translationId: number): number {
    const index = getIndex(langCode);
    const schema = index.schema;
    const query = Query.termQuery(schema, 'translation_id', translationId);
    const searcher = index.searcher();
    const result = searcher.search(query, 1, true);
    return result.count ?? 0;
}

export function getSearchSnippet(
    langCode: string,
    queryText: string,
    docAddress: DocAddress,
): string {
    const index = getIndex(langCode);
    const textFields = getTextFieldNames(index);
    const query = index.parseQuery(queryText, textFields);
    const searcher = index.searcher();
    const schema = index.schema;

    const generator = SnippetGenerator.create(searcher, query, schema, 'unstemmed_content');
    const doc = searcher.doc(docAddress);
    const snippet = generator.snippetFromDoc(doc);
    return snippet.toHtml();
}

// ---------------------------------------------------------------------------
// Testing helpers
// ---------------------------------------------------------------------------

export function _openIndexFromPathForTesting(langCode: string, path: string): void {
    const index = Index.open(path);
    registerTokenizersForIndex(index, join(path, 'meta.json'));
    index.configReader('OnCommit');
    indexCache.set(langCode, index);
}

export function _clearCacheForTesting(): void {
    indexCache.clear();
    sermonDatesCache.clear();
}
