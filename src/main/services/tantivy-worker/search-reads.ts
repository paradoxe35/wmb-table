import { Index, Query, SnippetGenerator, type DocAddress } from '@pngwasi/node-tantivy-binding';
import { buildLegacyQuery, buildModeQuery } from './query-builders';
import {
    extractNumeric,
    extractString,
    getIndex,
    getIndexCapabilities,
    INITIAL_SERMON_SEARCH_HITS,
    MAX_ORDERED_LINE_SCAN,
    MAX_SERMON_SEARCH_HITS,
    ORDER_ASC,
} from './shared';

export interface SermonParagraphResult {
    paragraphIndex: number;
    translationId: number;
    sermonId: number;
    content: string;
    stemmedContent?: string;
}

export interface GroupedSearchHitResult {
    translationId: number;
    tantivySermonDate: number;
    score: number;
    bestDocAddress: { segmentOrd: number; doc: number };
    bestParagraphIndex: number;
    hitCount: number;
}

export interface SearchSermonsReadResult {
    hits: GroupedSearchHitResult[];
    total: number;
    totalIsExact: boolean;
}

export interface MatchingParagraphSnippet {
    paragraphIndex: number;
    snippet: string;
    highlights: Array<{ start: number; end: number }>;
}

function buildOrderedLineQuery(index: Index, translationId: number, sermonDate: number): Query {
    const schema = index.schema;
    return Query.booleanQuery([
        { occur: 'must', query: Query.termQuery(schema, 'translation_id', translationId) },
        { occur: 'must', query: Query.termQuery(schema, 'sermon_date', sermonDate) },
    ]);
}

function buildParagraphScopedLineQuery(
    index: Index,
    translationId: number,
    sermonDate: number,
    paragraphIndices: number[],
): Query {
    const schema = index.schema;
    const paragraphFilter = Query.booleanQuery(
        paragraphIndices.map((paragraphIndex) => ({
            occur: 'should',
            query: Query.termQuery(schema, 'paragraph_index', paragraphIndex),
        })),
    );

    return Query.booleanQuery([
        { occur: 'must', query: Query.termQuery(schema, 'translation_id', translationId) },
        { occur: 'must', query: Query.termQuery(schema, 'sermon_date', sermonDate) },
        { occur: 'must', query: paragraphFilter },
    ]);
}

function searchOrderedLines(index: Index, query: Query) {
    return index.searcher().search(query, MAX_ORDERED_LINE_SCAN, false, 'line_index', 0, ORDER_ASC);
}

function groupSermonHits(index: Index, query: Query, fetchLimit: number): GroupedSearchHitResult[] {
    const searcher = index.searcher();
    const result = searcher.search(query, fetchLimit, true);
    const groups = new Map<
        string,
        {
            tantivySermonDate: number;
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
        const translationId = extractNumeric(dict, 'translation_id');
        const score = hit.score ?? 0;
        const groupKey = `${translationId}:${sermonDate}`;

        const existing = groups.get(groupKey);
        if (!existing) {
            groups.set(groupKey, {
                tantivySermonDate: sermonDate,
                translationId,
                score,
                bestDocAddress: {
                    segmentOrd: hit.docAddress.segmentOrd,
                    doc: hit.docAddress.doc,
                },
                bestParagraphIndex: extractNumeric(dict, 'paragraph_index'),
                hitCount: 1,
            });
            continue;
        }

        existing.hitCount++;
        if (score > existing.score) {
            existing.score = score;
            existing.translationId = translationId;
            existing.bestDocAddress = {
                segmentOrd: hit.docAddress.segmentOrd,
                doc: hit.docAddress.doc,
            };
            existing.bestParagraphIndex = extractNumeric(dict, 'paragraph_index');
        }
    }

    return Array.from(groups.values())
        .map((group) => ({
            translationId: group.translationId,
            tantivySermonDate: group.tantivySermonDate,
            score: group.score,
            bestDocAddress: group.bestDocAddress,
            bestParagraphIndex: group.bestParagraphIndex,
            hitCount: group.hitCount,
        }))
        .sort((a, b) => b.score - a.score);
}

export function getSermonParagraphs(
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

    const result = searchOrderedLines(index, Query.booleanQuery(clauses));
    const searcher = index.searcher();
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

    return Array.from(grouped.keys())
        .sort((a, b) => a - b)
        .map((paragraphIndex) => {
            const group = grouped.get(paragraphIndex)!;
            return {
                paragraphIndex,
                translationId: group.translationId,
                sermonId: group.sermonId,
                content: group.contents.join('\n'),
                ...(hasStemmed && group.stemmedContents.length > 0
                    ? { stemmedContent: group.stemmedContents.join('\n') }
                    : {}),
            };
        });
}

export function searchSermons(
    langCode: string,
    queryText: string,
    limit: number,
    offset: number,
    mode: 'any' | 'all' | 'exact' = 'all',
): SearchSermonsReadResult {
    const index = getIndex(langCode);
    const query = buildModeQuery(index, queryText, mode);
    const searcher = index.searcher();
    const totalLines = searcher.search(query, 1, true).count ?? 0;
    if (totalLines === 0) return { hits: [], total: 0, totalIsExact: true };

    const requiredGroups = offset + limit;
    let fetchLimit = Math.min(
        Math.max(INITIAL_SERMON_SEARCH_HITS, requiredGroups * 20),
        totalLines,
        MAX_SERMON_SEARCH_HITS,
    );
    let grouped = groupSermonHits(index, query, fetchLimit);

    while (
        grouped.length < requiredGroups &&
        fetchLimit < totalLines &&
        fetchLimit < MAX_SERMON_SEARCH_HITS
    ) {
        const nextLimit = Math.min(fetchLimit * 2, totalLines, MAX_SERMON_SEARCH_HITS);
        if (nextLimit === fetchLimit) break;
        fetchLimit = nextLimit;
        grouped = groupSermonHits(index, query, fetchLimit);
    }

    if (fetchLimit < totalLines) {
        console.warn(
            `[tantivy-worker] searchSermons("${queryText}") truncated at ${fetchLimit}/${totalLines} matching lines`,
        );
    }

    const totalIsExact = fetchLimit >= totalLines;
    return {
        hits: grouped.slice(offset, offset + limit),
        total: grouped.length,
        totalIsExact,
    };
}

export function getSearchSnippet(
    langCode: string,
    queryText: string,
    docAddress: { segmentOrd: number; doc: number },
): string {
    const index = getIndex(langCode);
    const query = buildLegacyQuery(index, queryText);
    const searcher = index.searcher();
    const generator = SnippetGenerator.create(searcher, query, index.schema, 'unstemmed_content');
    generator.setMaxNumChars(400);
    return generator.snippetFromDoc(searcher.doc(docAddress as DocAddress)).toHtml();
}

export function getMatchingParagraphs(
    langCode: string,
    queryText: string,
    translationId: number,
    sermonDate: number,
    mode: 'any' | 'all' | 'exact' = 'all',
): MatchingParagraphSnippet[] {
    const index = getIndex(langCode);
    const schema = index.schema;
    const searcher = index.searcher();
    const textQuery = buildModeQuery(index, queryText, mode);
    const result = searcher.search(
        Query.booleanQuery([
            { occur: 'must', query: Query.termQuery(schema, 'translation_id', translationId) },
            { occur: 'must', query: Query.termQuery(schema, 'sermon_date', sermonDate) },
            { occur: 'must', query: textQuery },
        ]),
        10000,
        true,
    );

    const paragraphMap = new Map<number, { docAddress: DocAddress; score: number }>();
    for (const hit of result.hits) {
        const doc = searcher.doc(hit.docAddress);
        const dict = doc.toDict() as Record<string, unknown[]>;
        const paragraphIndex = extractNumeric(dict, 'paragraph_index');
        const score = hit.score ?? 0;
        const existing = paragraphMap.get(paragraphIndex);
        if (!existing || score > existing.score) {
            paragraphMap.set(paragraphIndex, { docAddress: hit.docAddress, score });
        }
    }

    if (paragraphMap.size === 0) return [];

    const sortedParagraphs = Array.from(paragraphMap.keys()).sort((a, b) => a - b);
    const matchingIndices = new Set(sortedParagraphs);
    const capabilities = getIndexCapabilities(langCode);
    const allResult = capabilities.paragraphScopedQueriesSupported
        ? searchOrderedLines(
              index,
              buildParagraphScopedLineQuery(index, translationId, sermonDate, sortedParagraphs),
          )
        : searchOrderedLines(index, buildOrderedLineQuery(index, translationId, sermonDate));
    const linesByParagraph = new Map<number, { content: string; docAddress: DocAddress }[]>();

    for (const hit of allResult.hits) {
        const doc = searcher.doc(hit.docAddress);
        const dict = doc.toDict() as Record<string, unknown[]>;
        const paragraphIndex = extractNumeric(dict, 'paragraph_index');
        if (!matchingIndices.has(paragraphIndex)) continue;

        let lines = linesByParagraph.get(paragraphIndex);
        if (!lines) {
            lines = [];
            linesByParagraph.set(paragraphIndex, lines);
        }
        lines.push({
            content: extractString(dict, 'unstemmed_content'),
            docAddress: hit.docAddress,
        });
    }

    const generator = SnippetGenerator.create(searcher, textQuery, schema, 'unstemmed_content');
    generator.setMaxNumChars(10000);

    return sortedParagraphs.flatMap((paragraphIndex) => {
        const lines = linesByParagraph.get(paragraphIndex);
        if (!lines || lines.length === 0) return [];

        const highlights: Array<{ start: number; end: number }> = [];
        let offset = 0;
        for (const line of lines) {
            const doc = searcher.doc(line.docAddress);
            for (const highlight of generator.snippetFromDoc(doc).highlighted()) {
                highlights.push({
                    start: offset + highlight.start,
                    end: offset + highlight.end,
                });
            }
            offset += line.content.length + 1;
        }

        return [
            {
                paragraphIndex,
                snippet: lines.map((line) => line.content).join('\n'),
                highlights,
            },
        ];
    });
}
