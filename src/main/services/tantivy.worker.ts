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

/** ~25 word slop ≈ 150-character proximity for phrase matching. */
const PHRASE_SLOP = 25;

/**
 * Resolve the primary text field to search.
 *
 * We use `unstemmed_content` because termQuery/phraseQuery need raw indexed
 * tokens. The `stemmed_content` field has stemmed tokens (e.g., "apocalyps")
 * that we can't produce without the Rust stemmer — so termQuery("apocalypse")
 * would silently fail on it. Instead, we use fuzzyTermQuery on unstemmed to
 * handle plurals, typos, and conjugations.
 */
function getSearchField(index: Index): string {
    const fields = getTextFieldNames(index);
    return fields.includes('unstemmed_content') ? 'unstemmed_content' : fields[0];
}

/**
 * Build a query using native Tantivy APIs based on search mode.
 *
 * Uses termQuery + fuzzyTermQuery on unstemmed_content for:
 *   - Exact token matching (boosted 2×)
 *   - Typo/plural tolerance via edit distance 1 with prefix matching
 *
 * Available query types used:
 *   - `termQuery`          — exact indexed token match
 *   - `fuzzyTermQuery`     — edit distance + prefix matching (typos, plurals)
 *   - `phraseQuery`        — words in sequence with slop (proximity)
 *   - `booleanQuery`       — AND (must) combinations
 *   - `disjunctionMaxQuery`— OR with best-score selection
 *   - `boostQuery`         — score weighting
 */
function buildModeQuery(index: Index, queryText: string, mode: 'any' | 'all' | 'exact'): Query {
    const schema = index.schema;
    const words = queryText.trim().split(/\s+/).filter(Boolean);
    const field = getSearchField(index);

    if (words.length === 0) return Query.allQuery();

    function wordQuery(word: string): Query {
        return Query.termQuery(schema, field, word.toLowerCase());
    }

    // Single word: all modes behave the same (no phrase/order to enforce)
    // Also prevents phraseQuery crash (requires strictly > 1 term)
    if (words.length === 1) {
        return wordQuery(words[0]);
    }

    switch (mode) {
        case 'exact':
            return Query.phraseQuery(
                schema,
                field,
                words.map((w) => w.toLowerCase()),
                PHRASE_SLOP,
            );
        case 'all':
            return Query.booleanQuery(words.map((w) => ({ occur: 'must', query: wordQuery(w) })));
        case 'any':
            return Query.disjunctionMaxQuery(
                words.map((w) => wordQuery(w)),
                0.1,
            );
    }
}

/**
 * Legacy query builder using parseQueryLenient.
 * Only used by getSearchSnippet (SnippetGenerator requires a parsed query).
 */
function buildLegacyQuery(index: Index, queryText: string): Query {
    const textFields = getTextFieldNames(index);
    const fieldBoosts: Record<string, number> = {};
    const fuzzyFields: Record<string, [boolean, number, boolean]> = {};
    for (const field of textFields) {
        fieldBoosts[field] = field === 'unstemmed_content' ? 2.0 : 1.0;
        fuzzyFields[field] = [true, 1, true];
    }
    // Quote each term to prevent number parsing issues
    const sanitized = queryText
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => `"${t.replace(/"/g, '')}"`)
        .join(' ');
    const [query] = index.parseQueryLenient(sanitized, textFields, fieldBoosts, fuzzyFields);
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
        const content = extractString(dict, 'unstemmed_content');

        let group = grouped.get(paragraphIndex);
        if (!group) {
            group = {
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
    bestParagraphIndex: number;
    hitCount: number;
}

function searchSermons(
    langCode: string,
    queryText: string,
    limit: number,
    offset: number,
    mode: 'any' | 'all' | 'exact' = 'all',
): { hits: GroupedSearchHitResult[]; total: number } {
    const index = getIndex(langCode);
    const query = buildModeQuery(index, queryText, mode);
    const searcher = index.searcher();

    // Two-pass: count matching lines first, then fetch up to that (capped)
    // to discover all unique sermons for stable pagination.
    const countOnly = searcher.search(query, 1, true);
    const totalLines = countOnly.count ?? 0;
    if (totalLines === 0) return { hits: [], total: 0 };

    const fetchLimit = Math.min(totalLines, 10000);
    const result = searcher.search(query, fetchLimit, true);

    // Group by sermon_date (per sermon), not by translationId (per translator)
    const groups = new Map<
        number,
        {
            translationId: number;
            score: number;
            bestDocAddress: { segmentOrd: number; doc: number };
            bestParagraphIndex: number;
            hitCount: number;
        }
    >();

    for (const hit of result.hits) {
        const doc = searcher.doc(hit.docAddress);
        const dict = doc.toDict() as Record<string, unknown[]>;
        const sermonDate = extractNumeric(dict, 'sermon_date');
        const score = hit.score ?? 0;

        const existing = groups.get(sermonDate);
        if (!existing) {
            groups.set(sermonDate, {
                translationId: extractNumeric(dict, 'translation_id'),
                score,
                bestDocAddress: {
                    segmentOrd: hit.docAddress.segmentOrd,
                    doc: hit.docAddress.doc,
                },
                bestParagraphIndex: extractNumeric(dict, 'paragraph_index'),
                hitCount: 1,
            });
        } else {
            existing.hitCount++;
            if (score > existing.score) {
                existing.score = score;
                existing.translationId = extractNumeric(dict, 'translation_id');
                existing.bestDocAddress = {
                    segmentOrd: hit.docAddress.segmentOrd,
                    doc: hit.docAddress.doc,
                };
                existing.bestParagraphIndex = extractNumeric(dict, 'paragraph_index');
            }
        }
    }

    const sorted = Array.from(groups.entries())
        .map(([sermonDate, g]) => ({
            translationId: g.translationId,
            tantivySermonDate: sermonDate,
            score: g.score,
            bestDocAddress: g.bestDocAddress,
            bestParagraphIndex: g.bestParagraphIndex,
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
    const query = buildLegacyQuery(index, queryText);
    const searcher = index.searcher();
    const schema = index.schema;

    const generator = SnippetGenerator.create(searcher, query, schema, 'unstemmed_content');
    generator.setMaxNumChars(400);
    const doc = searcher.doc(docAddress as DocAddress);
    const snippet = generator.snippetFromDoc(doc);
    return snippet.toHtml();
}

interface MatchingParagraphSnippet {
    paragraphIndex: number;
    snippet: string;
    highlights: Array<{ start: number; end: number }>;
}

function getMatchingParagraphs(
    langCode: string,
    queryText: string,
    translationId: number,
    sermonDate: number,
    mode: 'any' | 'all' | 'exact' = 'all',
): MatchingParagraphSnippet[] {
    const index = getIndex(langCode);
    const schema = index.schema;
    const textQuery = buildModeQuery(index, queryText, mode);

    const boolQuery = Query.booleanQuery([
        { occur: 'must', query: Query.termQuery(schema, 'translation_id', translationId) },
        { occur: 'must', query: Query.termQuery(schema, 'sermon_date', sermonDate) },
        { occur: 'must', query: textQuery },
    ]);

    const searcher = index.searcher();
    const result = searcher.search(boolQuery, 10000, true);

    // Group by paragraph_index, keep best docAddress per paragraph
    const paragraphMap = new Map<number, { docAddress: DocAddress; score: number }>();
    for (const hit of result.hits) {
        const doc = searcher.doc(hit.docAddress);
        const dict = doc.toDict() as Record<string, unknown[]>;
        const pIdx = extractNumeric(dict, 'paragraph_index');
        const score = hit.score ?? 0;

        const existing = paragraphMap.get(pIdx);
        if (!existing || score > existing.score) {
            paragraphMap.set(pIdx, { docAddress: hit.docAddress, score });
        }
    }

    // Sort by paragraphIndex
    const sorted = Array.from(paragraphMap.entries()).sort((a, b) => a[0] - b[0]);

    // Collect all lines for matching paragraphs.
    // paragraph_index is not indexed so we query all sermon lines and filter in-memory.
    const matchingIndices = new Set(sorted.map(([idx]) => idx));

    const allLinesQuery = Query.booleanQuery([
        { occur: 'must', query: Query.termQuery(schema, 'translation_id', translationId) },
        { occur: 'must', query: Query.termQuery(schema, 'sermon_date', sermonDate) },
    ]);
    const allResult = searcher.search(allLinesQuery, 100000, false, 'line_index', 0, ORDER_ASC);

    // Collect lines AND their DocAddresses for SnippetGenerator
    const lineData = new Map<number, { content: string; docAddress: DocAddress }[]>();
    for (const hit of allResult.hits) {
        const doc = searcher.doc(hit.docAddress);
        const dict = doc.toDict() as Record<string, unknown[]>;
        const pIdx = extractNumeric(dict, 'paragraph_index');
        if (!matchingIndices.has(pIdx)) continue;
        const content = extractString(dict, 'unstemmed_content');
        let lines = lineData.get(pIdx);
        if (!lines) {
            lines = [];
            lineData.set(pIdx, lines);
        }
        lines.push({ content, docAddress: hit.docAddress });
    }

    // Build paragraph content with highlights extracted from toHtml().
    // highlighted() returns wrong positions, but toHtml() is accurate.
    const generator = SnippetGenerator.create(searcher, textQuery, schema, 'unstemmed_content');
    generator.setMaxNumChars(10000);

    const snippets: MatchingParagraphSnippet[] = [];
    for (const [paragraphIndex] of sorted) {
        const lines = lineData.get(paragraphIndex);
        if (!lines || lines.length === 0) continue;

        const content = lines.map((l) => l.content).join('\n');
        const highlights: Array<{ start: number; end: number }> = [];
        let offset = 0;

        for (const line of lines) {
            const doc = searcher.doc(line.docAddress);
            const html = generator.snippetFromDoc(doc).toHtml();
            // Parse <b> tags from toHtml to get accurate highlight positions
            let pos = 0;
            let i = 0;
            while (i < html.length) {
                if (html.startsWith('<b>', i)) {
                    const start = pos;
                    i += 3;
                    while (i < html.length && !html.startsWith('</b>', i)) {
                        pos++;
                        i++;
                    }
                    highlights.push({ start: offset + start, end: offset + pos });
                    if (html.startsWith('</b>', i)) i += 4;
                } else {
                    pos++;
                    i++;
                }
            }
            offset += line.content.length + 1; // +1 for \n
        }

        snippets.push({ paragraphIndex, snippet: content, highlights });
    }

    return snippets;
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
// More Like This — find sermons with similar content
// ---------------------------------------------------------------------------

interface SimilarParagraphResult {
    paragraphIndex: number;
    snippet: string;
    score: number;
}

interface SimilarSermonResult {
    translationId: number;
    tantivySermonDate: number;
    score: number;
    paragraphs: SimilarParagraphResult[];
}

function findSimilarSermons(
    langCode: string,
    translationId: number,
    sermonDate: number,
    paragraphIndex: number,
    limit: number = 10,
): { hits: SimilarSermonResult[]; total: number } {
    const index = getIndex(langCode);
    const schema = index.schema;
    const searcher = index.searcher();

    // 1. Find a line from the source paragraph.
    //    paragraph_index is not indexed, so we fetch all sermon lines and filter in-memory.
    const sermonQuery = Query.booleanQuery([
        { occur: 'must', query: Query.termQuery(schema, 'translation_id', translationId) },
        { occur: 'must', query: Query.termQuery(schema, 'sermon_date', sermonDate) },
    ]);
    const allLines = searcher.search(sermonQuery, 100000, false);
    let sourceDocAddress: DocAddress | null = null;
    for (const hit of allLines.hits) {
        const doc = searcher.doc(hit.docAddress);
        const dict = doc.toDict() as Record<string, unknown[]>;
        if (extractNumeric(dict, 'paragraph_index') === paragraphIndex) {
            sourceDocAddress = hit.docAddress;
            break;
        }
    }
    if (!sourceDocAddress) return { hits: [], total: 0 };

    // 2. Find similar documents using TF-IDF term extraction
    const mltQuery = Query.moreLikeThisQuery(
        sourceDocAddress,
        2, // minDocFrequency
        null, // maxDocFrequency
        1, // minTermFrequency
        25, // maxQueryTerms
        3, // minWordLength — skip short words
        null, // maxWordLength
        1.0, // boostFactor
        null, // stopWords
    );
    const result = searcher.search(mltQuery, limit * 30, true);

    // 2. Group by (sermon_date, paragraph_index) — unique paragraphs
    type ParagraphKey = string; // "sermonDate:paragraphIndex"
    const paragraphGroups = new Map<
        ParagraphKey,
        {
            sermonDate: number;
            translationId: number;
            paragraphIndex: number;
            score: number;
            docAddress: DocAddress;
        }
    >();

    for (const hit of result.hits) {
        const doc = searcher.doc(hit.docAddress);
        const dict = doc.toDict() as Record<string, unknown[]>;
        const hitSermonDate = extractNumeric(dict, 'sermon_date');
        if (hitSermonDate === sermonDate) continue; // skip source sermon

        const pIdx = extractNumeric(dict, 'paragraph_index');
        const score = hit.score ?? 0;
        const key: ParagraphKey = `${hitSermonDate}:${pIdx}`;

        const existing = paragraphGroups.get(key);
        if (!existing || score > existing.score) {
            paragraphGroups.set(key, {
                sermonDate: hitSermonDate,
                translationId: extractNumeric(dict, 'translation_id'),
                paragraphIndex: pIdx,
                score,
                docAddress: hit.docAddress,
            });
        }
    }

    // 3. Fetch full paragraph content for each matching paragraph
    const paragraphsBySermon = new Map<number, SimilarParagraphResult[]>();
    const sermonScores = new Map<number, { score: number; translationId: number }>();

    // Sort paragraphs by score, take top ones
    const topParagraphs = Array.from(paragraphGroups.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit * 3);

    for (const pg of topParagraphs) {
        // Get all lines for this paragraph to build full content
        const linesQuery = Query.booleanQuery([
            { occur: 'must', query: Query.termQuery(schema, 'translation_id', pg.translationId) },
            { occur: 'must', query: Query.termQuery(schema, 'sermon_date', pg.sermonDate) },
        ]);
        // Check if we already fetched lines for this sermon
        if (!paragraphsBySermon.has(pg.sermonDate)) {
            const linesResult = searcher.search(
                linesQuery,
                100000,
                false,
                'line_index',
                0,
                ORDER_ASC,
            );
            const sermonLines = new Map<number, string[]>();
            for (const lineHit of linesResult.hits) {
                const lineDoc = searcher.doc(lineHit.docAddress);
                const lineDict = lineDoc.toDict() as Record<string, unknown[]>;
                const linePIdx = extractNumeric(lineDict, 'paragraph_index');
                const content = extractString(lineDict, 'unstemmed_content');
                let lines = sermonLines.get(linePIdx);
                if (!lines) {
                    lines = [];
                    sermonLines.set(linePIdx, lines);
                }
                lines.push(content);
            }
            // Store all paragraph texts for this sermon
            for (const [pIdx, lines] of sermonLines) {
                const existing = paragraphsBySermon.get(pg.sermonDate) ?? [];
                // Only add paragraphs that are in our top matches
                const match = topParagraphs.find(
                    (tp) => tp.sermonDate === pg.sermonDate && tp.paragraphIndex === pIdx,
                );
                if (match) {
                    existing.push({
                        paragraphIndex: pIdx,
                        snippet: lines.join('\n'),
                        score: match.score,
                    });
                    paragraphsBySermon.set(pg.sermonDate, existing);
                }
            }
        }

        const sermonScore = sermonScores.get(pg.sermonDate);
        if (!sermonScore || pg.score > sermonScore.score) {
            sermonScores.set(pg.sermonDate, { score: pg.score, translationId: pg.translationId });
        }
    }

    // 4. Build final results grouped by sermon, sorted by best paragraph score
    const hits: SimilarSermonResult[] = [];
    for (const [sd, info] of sermonScores) {
        const paragraphs = (paragraphsBySermon.get(sd) ?? []).sort((a, b) => b.score - a.score);
        if (paragraphs.length === 0) continue;
        hits.push({
            translationId: info.translationId,
            tantivySermonDate: sd,
            score: info.score,
            paragraphs,
        });
    }

    hits.sort((a, b) => b.score - a.score);
    return { hits: hits.slice(0, limit), total: hits.length };
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
    getMatchingParagraphs,
    getSermonParagraphCount,
    findSimilarSermons,
};

parentPort?.on('message', (msg: WorkerRequest) => {
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
