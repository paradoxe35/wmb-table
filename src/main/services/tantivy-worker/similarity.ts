import { Query, type DocAddress } from '@pngwasi/node-tantivy-binding';
import {
    extractNumeric,
    extractString,
    getIndex,
    getIndexCapabilities,
    MAX_ORDERED_LINE_SCAN,
    ORDER_ASC,
} from './shared';

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

export function findSimilarSermons(
    langCode: string,
    translationId: number,
    sermonDate: number,
    paragraphIndex: number,
    limit: number = 10,
): { hits: SimilarSermonResult[]; total: number } {
    const index = getIndex(langCode);
    const capabilities = getIndexCapabilities(langCode);
    const schema = index.schema;
    const searcher = index.searcher();

    const sourceParagraphQuery = Query.booleanQuery([
        { occur: 'must', query: Query.termQuery(schema, 'translation_id', translationId) },
        { occur: 'must', query: Query.termQuery(schema, 'sermon_date', sermonDate) },
        ...(capabilities.paragraphScopedQueriesSupported
            ? [
                  {
                      occur: 'must' as const,
                      query: Query.termQuery(schema, 'paragraph_index', paragraphIndex),
                  },
              ]
            : []),
    ]);
    const sermonLines = searcher.search(sourceParagraphQuery, MAX_ORDERED_LINE_SCAN, false);

    let sourceDocAddress: DocAddress | null = null;
    for (const hit of sermonLines.hits) {
        const doc = searcher.doc(hit.docAddress);
        const dict = doc.toDict() as Record<string, unknown[]>;
        if (extractNumeric(dict, 'paragraph_index') === paragraphIndex) {
            sourceDocAddress = hit.docAddress;
            break;
        }
    }
    if (!sourceDocAddress) return { hits: [], total: 0 };

    const result = searcher.search(
        Query.moreLikeThisQuery(sourceDocAddress, 2, null, 1, 25, 3, null, 1.0, null),
        limit * 30,
        true,
    );

    type ParagraphKey = string;
    const paragraphGroups = new Map<
        ParagraphKey,
        {
            sermonDate: number;
            translationId: number;
            paragraphIndex: number;
            score: number;
        }
    >();

    for (const hit of result.hits) {
        const doc = searcher.doc(hit.docAddress);
        const dict = doc.toDict() as Record<string, unknown[]>;
        const hitSermonDate = extractNumeric(dict, 'sermon_date');
        if (hitSermonDate === sermonDate) continue;

        const hitParagraphIndex = extractNumeric(dict, 'paragraph_index');
        const key: ParagraphKey = `${hitSermonDate}:${hitParagraphIndex}`;
        const score = hit.score ?? 0;
        const existing = paragraphGroups.get(key);
        if (!existing || score > existing.score) {
            paragraphGroups.set(key, {
                sermonDate: hitSermonDate,
                translationId: extractNumeric(dict, 'translation_id'),
                paragraphIndex: hitParagraphIndex,
                score,
            });
        }
    }

    const topParagraphs = Array.from(paragraphGroups.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit * 3);
    const topParagraphMap = new Map(
        topParagraphs.map((paragraph) => [
            `${paragraph.sermonDate}:${paragraph.paragraphIndex}`,
            paragraph,
        ]),
    );

    const paragraphsBySermon = new Map<number, SimilarParagraphResult[]>();
    const sermonScores = new Map<number, { score: number; translationId: number }>();

    for (const paragraph of topParagraphs) {
        if (!paragraphsBySermon.has(paragraph.sermonDate)) {
            const paragraphFilters = topParagraphs
                .filter((candidate) => candidate.sermonDate === paragraph.sermonDate)
                .map((candidate) => ({
                    occur: 'should' as const,
                    query: Query.termQuery(schema, 'paragraph_index', candidate.paragraphIndex),
                }));
            const linesResult = searcher.search(
                Query.booleanQuery([
                    {
                        occur: 'must',
                        query: Query.termQuery(schema, 'translation_id', paragraph.translationId),
                    },
                    {
                        occur: 'must',
                        query: Query.termQuery(schema, 'sermon_date', paragraph.sermonDate),
                    },
                    ...(capabilities.paragraphScopedQueriesSupported && paragraphFilters.length > 0
                        ? [
                              {
                                  occur: 'must' as const,
                                  query: Query.booleanQuery(paragraphFilters),
                              },
                          ]
                        : []),
                ]),
                MAX_ORDERED_LINE_SCAN,
                false,
                'line_index',
                0,
                ORDER_ASC,
            );

            const sermonParagraphs: SimilarParagraphResult[] = [];
            const sermonLines = new Map<number, string[]>();
            for (const lineHit of linesResult.hits) {
                const lineDoc = searcher.doc(lineHit.docAddress);
                const lineDict = lineDoc.toDict() as Record<string, unknown[]>;
                const lineParagraphIndex = extractNumeric(lineDict, 'paragraph_index');
                let lines = sermonLines.get(lineParagraphIndex);
                if (!lines) {
                    lines = [];
                    sermonLines.set(lineParagraphIndex, lines);
                }
                lines.push(extractString(lineDict, 'unstemmed_content'));
            }

            for (const [lineParagraphIndex, lines] of sermonLines) {
                const topParagraph = topParagraphMap.get(
                    `${paragraph.sermonDate}:${lineParagraphIndex}`,
                );
                if (!topParagraph) continue;
                sermonParagraphs.push({
                    paragraphIndex: lineParagraphIndex,
                    snippet: lines.join('\n'),
                    score: topParagraph.score,
                });
            }

            paragraphsBySermon.set(paragraph.sermonDate, sermonParagraphs);
        }

        const sermonScore = sermonScores.get(paragraph.sermonDate);
        if (!sermonScore || paragraph.score > sermonScore.score) {
            sermonScores.set(paragraph.sermonDate, {
                score: paragraph.score,
                translationId: paragraph.translationId,
            });
        }
    }

    const hits = Array.from(sermonScores.entries())
        .map(([tantivySermonDate, info]) => ({
            translationId: info.translationId,
            tantivySermonDate,
            score: info.score,
            paragraphs: (paragraphsBySermon.get(tantivySermonDate) ?? []).sort(
                (a, b) => b.score - a.score,
            ),
        }))
        .filter((hit) => hit.paragraphs.length > 0)
        .sort((a, b) => b.score - a.score);

    return { hits: hits.slice(0, limit), total: hits.length };
}
