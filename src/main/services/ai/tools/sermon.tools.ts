import { z } from 'zod';
import * as referenceRepo from '@main/database/repositories/reference.repository';
import * as referenceDataService from '@main/services/reference-data.service';
import * as tantivyService from '@main/services/tantivy.service';
import { matchesQuery, strNormalize, strNormalizeNoLower, simpleRegExp } from '@shared/searchable';
import type { SearchMode } from '@shared/types';
import type { AiToolDefinition } from './types';
import { validateLanguage } from './shared';

export function buildSermonTools(defaultLanguageCode: string): Record<string, AiToolDefinition> {
    return {
        searchSermons: {
            description:
                'Search sermons by title, date, sermon id, town/city, state, or location. ' +
                'Returns sermon metadata. Each result includes a sermonId and translationId — ' +
                'pass both to getSermonContent to retrieve the text.',
            inputSchema: z.object({
                query: z.string().min(1),
                languageCode: z.string().optional(),
                limit: z.number().int().min(1).max(20).optional(),
            }),
            execute: async ({ query, languageCode, limit = 10 }) => {
                const lang = languageCode ?? defaultLanguageCode;
                const langError = validateLanguage(lang);
                if (langError) return langError;

                const words = query
                    .trim()
                    .split(/\s+/)
                    .filter((w: string) => w.length >= 2);
                const patterns = words.map((w: string) => simpleRegExp(w));
                const sermons = referenceDataService
                    .getSermonListForLanguage(lang)
                    .filter((sermon) => {
                        const fields = strNormalize(
                            [
                                sermon.title,
                                sermon.enTitle,
                                sermon.location,
                                sermon.cityState,
                                sermon.sermonId,
                                new Date(sermon.dateMs).toISOString().slice(0, 10),
                            ]
                                .filter(Boolean)
                                .join(' '),
                        );
                        return patterns.every((re: RegExp) => {
                            re.lastIndex = 0;
                            return re.test(fields);
                        });
                    });
                return { results: sermons.slice(0, limit), total: sermons.length };
            },
        },
        getSermonContent: {
            description:
                'Retrieve the text content (paragraphs) of a sermon. ' +
                'You MUST pass sermonId (and translationId if available from searchSermons results). ' +
                'Use startParagraph and maxParagraphs to paginate through long sermons. ' +
                'To get a general overview, read the first 15 paragraphs.',
            inputSchema: z.object({
                sermonId: z.string(),
                languageCode: z.string().optional(),
                translationId: z.number().int().optional(),
                startParagraph: z.number().int().min(0).optional(),
                maxParagraphs: z.number().int().min(1).max(50).optional(),
            }),
            execute: async ({
                sermonId: rawSermonId,
                languageCode,
                translationId,
                startParagraph = 0,
                maxParagraphs = 15,
            }) => {
                const sermonId = rawSermonId.trim();
                const lang = languageCode ?? defaultLanguageCode;
                const langError = validateLanguage(lang);
                if (langError) return langError;

                // Try exact match with translationId first
                let meta = translationId
                    ? referenceDataService.getSermonMeta(translationId, lang, sermonId)
                    : null;

                // Fallback: find any translation for this sermonId
                if (!meta) {
                    const allForSermon = referenceDataService.getTraductionsForSermon(
                        sermonId,
                        lang,
                    );
                    meta = allForSermon[0] ?? null;
                }

                // Last resort: scan full list
                if (!meta) {
                    meta =
                        referenceDataService
                            .getSermonListForLanguage(lang)
                            .find((sermon) => sermon.sermonId === sermonId) ?? null;
                }

                if (!meta) {
                    return { error: `Sermon "${sermonId}" not found for language "${lang}".` };
                }

                try {
                    const paragraphs = await tantivyService.getSermonParagraphs(
                        lang,
                        meta.translationId,
                        meta.dateMs,
                    );

                    if (paragraphs.length === 0) {
                        return {
                            meta,
                            error: 'No paragraphs found. The sermon content may not be indexed yet.',
                            totalParagraphs: 0,
                        };
                    }

                    return {
                        meta,
                        paragraphs: paragraphs.slice(
                            startParagraph,
                            startParagraph + maxParagraphs,
                        ),
                        totalParagraphs: paragraphs.length,
                        startParagraph,
                    };
                } catch (err) {
                    return {
                        error: `Failed to retrieve sermon content: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
            },
        },
        searchContent: {
            description:
                'Full-text search inside sermon content. Use this when searching for specific words, ' +
                'phrases, or quotes within the text of sermons (not titles). ' +
                'Returns matching sermons with relevant paragraph snippets.',
            inputSchema: z.object({
                query: z.string().min(2),
                languageCode: z.string().optional(),
                searchMode: z
                    .enum(['any', 'all', 'exact'])
                    .optional()
                    .describe(
                        'Search mode: "any" matches any word, "all" requires all words, "exact" matches the phrase. Defaults to "any".',
                    ),
                limit: z.number().int().min(1).max(20).optional(),
            }),
            execute: async ({ query, languageCode, searchMode: rawMode, limit = 10 }) => {
                const lang = languageCode ?? defaultLanguageCode;
                const mode: SearchMode = rawMode ?? 'any';
                const langError = validateLanguage(lang);
                if (langError) return langError;

                try {
                    const result = await tantivyService.searchSermons(lang, query, limit, 0);
                    const items = [];
                    for (const hit of result.hits.slice(0, limit)) {
                        const sermonId = referenceRepo.tantivyDateToSermonIds(
                            hit.tantivySermonDate,
                        )[0];
                        if (!sermonId) continue;
                        const meta = referenceDataService.getSermonMeta(
                            hit.translationId,
                            lang,
                            sermonId,
                        );
                        const rawParagraphs = await tantivyService.getMatchingParagraphs(
                            lang,
                            query,
                            hit.translationId,
                            hit.tantivySermonDate,
                        );
                        const filtered = rawParagraphs.filter((p) =>
                            matchesQuery(strNormalizeNoLower(p.snippet), query, mode),
                        );
                        if (filtered.length === 0) continue;
                        items.push({
                            sermonId,
                            title: meta?.title ?? meta?.enTitle ?? sermonId,
                            enTitle: meta?.enTitle ?? undefined,
                            dateMs: meta?.dateMs ?? undefined,
                            matches: filtered.slice(0, 5).map((p) => ({
                                paragraphIndex: p.paragraphIndex,
                                snippet: p.snippet,
                            })),
                            totalMatches: filtered.length,
                        });
                    }
                    return { results: items, totalSermons: result.total };
                } catch (err) {
                    return {
                        error: `Full-text search failed: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
            },
        },
    };
}
