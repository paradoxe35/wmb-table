import { parentPort } from 'node:worker_threads';
import { join } from 'node:path';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import {
    Index,
    Query,
    SnippetGenerator,
    TextAnalyzerBuilder,
    TokenizerStatic,
    FilterStatic,
    type DocAddress,
} from '@oxdev03/node-tantivy-binding';

// ---------------------------------------------------------------------------
// Types
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

interface WorkerRequest {
    id: number;
    method: string;
    args: unknown[];
}

interface WorkerResponse {
    id: number;
    result?: unknown;
    error?: string;
}

// Order is a const enum in the binding, which can't be accessed with isolatedModules.
const ORDER_ASC = 0 as const;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const indexCache = new Map<string, Index>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function registerTokenizersForIndex(
    index: Index,
    metaJsonPath: string,
    langEnglishTitle: string | null,
): void {
    const raw = readFileSync(metaJsonPath, 'utf-8');
    const meta = JSON.parse(raw) as { schema: MetaJsonSchema[] };

    const registered = new Set<string>();
    for (const field of meta.schema) {
        const tokenizerName = field.options?.indexing?.tokenizer;
        if (!tokenizerName || tokenizerName === 'default' || registered.has(tokenizerName))
            continue;

        const tokenizer = buildStemTokenizer(tokenizerName, langEnglishTitle);
        if (tokenizer) {
            index.registerTokenizer(tokenizerName, tokenizer);
            registered.add(tokenizerName);
        }
    }
}

function getTextFieldNames(index: Index): string[] {
    const schema = index.schema;
    const names: string[] = [];
    for (const name of schema.fieldNames()) {
        if (schema.getFieldType(name) === 0) {
            names.push(name);
        }
    }
    return names;
}

function getIndex(langCode: string): Index {
    const idx = indexCache.get(langCode);
    if (!idx) throw new Error(`No Tantivy index loaded for language "${langCode}"`);
    return idx;
}

function buildQuery(index: Index, queryText: string): Query {
    const textFields = getTextFieldNames(index);
    const fieldBoosts: Record<string, number> = { unstemmed_content: 2.0, stemmed_content: 1.0 };
    const fuzzyFields: Record<string, [boolean, number, boolean]> = {
        unstemmed_content: [true, 1, true],
        stemmed_content: [true, 1, true],
    };
    const [query, errors] = index.parseQueryLenient(
        queryText,
        textFields,
        fieldBoosts,
        fuzzyFields,
    );
    if (errors.length > 0) {
        console.warn('[tantivy] Query parse warnings:', errors);
    }
    return query;
}

// ---------------------------------------------------------------------------
// Methods exposed to main process
// ---------------------------------------------------------------------------

function initialize(indexesDir: string, langTitles: Record<string, string>): void {
    if (!existsSync(indexesDir)) return;

    let entries: string[];
    try {
        entries = readdirSync(indexesDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name);
    } catch {
        return;
    }

    for (const langCode of entries) {
        const indexPath = join(indexesDir, langCode);
        const metaPath = join(indexPath, 'meta.json');
        if (!existsSync(metaPath)) continue;

        try {
            openIndex(indexesDir, langCode, langTitles[langCode] ?? null);
        } catch {
            // skip failed indexes
        }
    }
}

function openIndex(indexesDir: string, langCode: string, langEnglishTitle: string | null): void {
    const indexPath = join(indexesDir, langCode);
    const index = Index.open(indexPath);
    registerTokenizersForIndex(index, join(indexPath, 'meta.json'), langEnglishTitle);
    index.configReader('OnCommit');
    indexCache.set(langCode, index);
}

function closeAllIndexes(): void {
    indexCache.clear();
}

function getInstalledLanguages(): string[] {
    return Array.from(indexCache.keys());
}

interface SermonParagraphResult {
    lineIndex: number;
    paragraphIndex: number;
    translationId: number;
    sermonId: number;
    content: string;
    stemmedContent?: string;
}

function getSermonParagraphs(
    langCode: string,
    translationId: number,
    sermonId?: number,
): SermonParagraphResult[] {
    const index = getIndex(langCode);
    const schema = index.schema;
    const hasStemmed = schema.hasField('stemmed_content');

    const clauses: { occur: string; query: Query }[] = [
        { occur: 'must', query: Query.termQuery(schema, 'translation_id', translationId) },
    ];
    if (sermonId !== undefined) {
        clauses.push({
            occur: 'must',
            query: Query.termQuery(schema, 'sermon_date', sermonId),
        });
    }
    const query = Query.booleanQuery(clauses);
    const searcher = index.searcher();
    const result = searcher.search(query, 10000, false, 'line_index', 0, ORDER_ASC);

    // Group lines by paragraph_index — multiple lines can share the same paragraph
    const grouped = new Map<
        number,
        {
            lineIndex: number;
            translationId: number;
            sermonId: number;
            contents: string[];
            stemmedContents: string[];
        }
    >();

    for (const hit of result.hits) {
        const doc = searcher.doc(hit.docAddress);
        const dict = doc.toDict() as Record<string, unknown[]>;

        const paragraphIndex = extractNumeric(dict, 'paragraph_index');
        const lineIndex = extractNumeric(dict, 'line_index');
        const content = extractString(dict, 'unstemmed_content');

        let group = grouped.get(paragraphIndex);
        if (!group) {
            group = {
                lineIndex,
                translationId: extractNumeric(dict, 'translation_id'),
                sermonId: extractNumeric(dict, 'sermon_date'),
                contents: [],
                stemmedContents: [],
            };
            grouped.set(paragraphIndex, group);
        }

        group.contents.push(content);
        if (hasStemmed) {
            const stemmed = extractString(dict, 'stemmed_content');
            if (stemmed) group.stemmedContents.push(stemmed);
        }
    }

    // Build merged paragraphs sorted by paragraph_index
    const paragraphs: SermonParagraphResult[] = [];
    const sortedKeys = Array.from(grouped.keys()).sort((a, b) => a - b);
    for (const key of sortedKeys) {
        const group = grouped.get(key)!;
        const paragraph: SermonParagraphResult = {
            lineIndex: group.lineIndex,
            paragraphIndex: key,
            translationId: group.translationId,
            sermonId: group.sermonId,
            content: group.contents.join('\n'),
        };
        if (hasStemmed && group.stemmedContents.length > 0) {
            paragraph.stemmedContent = group.stemmedContents.join('\n');
        }
        paragraphs.push(paragraph);
    }

    return paragraphs;
}

interface GroupedSearchHitResult {
    translationId: number;
    tantivySermonDate: number;
    score: number;
    bestDocAddress: { segmentOrd: number; doc: number };
    hitCount: number;
}

function searchSermons(
    langCode: string,
    queryText: string,
    limit: number,
    offset: number,
): { hits: GroupedSearchHitResult[]; total: number } {
    const index = getIndex(langCode);
    const query = buildQuery(index, queryText);
    const searcher = index.searcher();

    const fetchLimit = Math.min((offset + limit) * 20, 10000);
    const result = searcher.search(query, fetchLimit, true);

    const groups = new Map<
        number,
        {
            score: number;
            bestDocAddress: { segmentOrd: number; doc: number };
            hitCount: number;
            tantivySermonDate: number;
        }
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
                bestDocAddress: {
                    segmentOrd: hit.docAddress.segmentOrd,
                    doc: hit.docAddress.doc,
                },
                hitCount: 1,
                tantivySermonDate: extractNumeric(dict, 'sermon_date'),
            });
        } else {
            existing.hitCount++;
            if (score > existing.score) {
                existing.score = score;
                existing.bestDocAddress = {
                    segmentOrd: hit.docAddress.segmentOrd,
                    doc: hit.docAddress.doc,
                };
            }
        }
    }

    const sorted = Array.from(groups.entries())
        .map(([translationId, g]) => ({
            translationId,
            tantivySermonDate: g.tantivySermonDate,
            score: g.score,
            bestDocAddress: g.bestDocAddress,
            hitCount: g.hitCount,
        }))
        .sort((a, b) => b.score - a.score);

    const total = sorted.length;
    const hits = sorted.slice(offset, offset + limit);

    return { hits, total };
}

function getSearchSnippet(
    langCode: string,
    queryText: string,
    docAddress: { segmentOrd: number; doc: number },
): string {
    const index = getIndex(langCode);
    const query = buildQuery(index, queryText);
    const searcher = index.searcher();
    const schema = index.schema;

    const generator = SnippetGenerator.create(searcher, query, schema, 'unstemmed_content');
    generator.setMaxNumChars(400);
    const doc = searcher.doc(docAddress as DocAddress);
    const snippet = generator.snippetFromDoc(doc);
    return snippet.toHtml();
}

function getSermonParagraphCount(
    langCode: string,
    translationId: number,
    sermonId?: number,
): number {
    if (sermonId !== undefined) {
        return getSermonParagraphs(langCode, translationId, sermonId).length;
    }
    const index = getIndex(langCode);
    const schema = index.schema;
    const query = Query.termQuery(schema, 'translation_id', translationId);
    const searcher = index.searcher();
    const result = searcher.search(query, 1, true);
    return result.count ?? 0;
}

// ---------------------------------------------------------------------------
// Method dispatch
// ---------------------------------------------------------------------------

const methods: Record<string, (...args: never[]) => unknown> = {
    initialize,
    openIndex,
    closeAllIndexes,
    getInstalledLanguages,
    getSermonParagraphs,
    searchSermons,
    getSearchSnippet,
    getSermonParagraphCount,
};

parentPort!.on('message', (msg: WorkerRequest) => {
    const { id, method, args } = msg;
    try {
        const fn = methods[method];
        if (!fn) throw new Error(`Unknown worker method: ${method}`);
        const result = fn(...(args as never[]));
        const response: WorkerResponse = { id, result };
        parentPort!.postMessage(response);
    } catch (err) {
        const response: WorkerResponse = {
            id,
            error: err instanceof Error ? err.message : String(err),
        };
        parentPort!.postMessage(response);
    }
});
