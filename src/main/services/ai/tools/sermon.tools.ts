import { z } from 'zod';
import * as referenceDataService from '@main/services/reference-data.service';
import * as tantivyService from '@main/services/tantivy.service';
import * as searchService from '@main/services/search.service';
import { strNormalize, simpleRegExp } from '@shared/searchable';
import { DEFAULT_SEARCH_MODE } from '@shared/constants';
import type { SearchMode } from '@shared/types';
import type {
    AiToolDefinition,
    SermonSearchResult,
    SermonContentMeta,
    SermonContentResponse,
    SermonParagraphResult,
    SearchContentHit,
} from './types';
import { validateLanguage } from './shared';

export function buildSermonTools(defaultContentLanguage: string): Record<string, AiToolDefinition> {
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
                const lang = languageCode ?? defaultContentLanguage;
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
                const results: SermonSearchResult[] = sermons.slice(0, limit).map((s) => ({
                    sermonId: s.sermonId,
                    translationId: s.translationId,
                    title: s.title,
                    enTitle: s.enTitle || undefined,
                    dateMs: s.dateMs,
                    location: s.location || undefined,
                }));
                return { results, total: sermons.length };
            },
        },
        getSermonContent: {
            description:
                'Retrieve the text content (paragraphs) of a sermon. ' +
                'You MUST pass sermonId (and translationId if available from searchSermons results). ' +
                'Use startParagraph and maxParagraphs to paginate through long sermons. ' +
                'To get a general overview, read the first 15 paragraphs. ' +
                'Each paragraph has a paragraphNumber field — always use that value when building wmb:// reference links.',
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
                const lang = languageCode ?? defaultContentLanguage;
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
                    const rawParagraphs = await tantivyService.getSermonParagraphs(
                        lang,
                        meta.translationId,
                        meta.dateMs,
                    );

                    const slimMeta: SermonContentMeta = {
                        sermonId: meta.sermonId,
                        translationId: meta.translationId,
                        title: meta.title,
                        dateMs: meta.dateMs,
                    };

                    if (rawParagraphs.length === 0) {
                        return {
                            meta: slimMeta,
                            error: 'No paragraphs found. The sermon content may not be indexed yet.',
                            totalParagraphs: 0,
                        };
                    }

                    const paragraphs: SermonParagraphResult[] = rawParagraphs
                        .slice(startParagraph, startParagraph + maxParagraphs)
                        .map((p) => ({
                            paragraphNumber: p.paragraphIndex,
                            content: p.content,
                        }));

                    const response: SermonContentResponse = {
                        meta: slimMeta,
                        paragraphs,
                        totalParagraphs: rawParagraphs.length,
                        startParagraph,
                    };
                    return response;
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
                'Returns matching sermons with relevant paragraph snippets. ' +
                'Each match has a paragraphNumber — use it for wmb:// reference links.',
            inputSchema: z.object({
                query: z.string().min(2),
                languageCode: z.string().optional(),
                searchMode: z
                    .enum(['any', 'all', 'exact'])
                    .optional()
                    .describe(
                        `Search mode: "any" matches any word, "all" requires all words, "exact" matches the exact phrase. Defaults to "${DEFAULT_SEARCH_MODE}".`,
                    ),
                limit: z.number().int().min(1).max(20).optional(),
            }),
            execute: async ({ query, languageCode, searchMode: rawMode, limit = 10 }) => {
                const lang = languageCode ?? defaultContentLanguage;
                const mode: SearchMode = rawMode ?? DEFAULT_SEARCH_MODE;
                const langError = validateLanguage(lang);
                if (langError) {
                    return langError;
                }

                try {
                    const { matches, total } = await searchService.searchSermons({
                        langCode: lang,
                        query,
                        mode,
                        limit,
                        offset: 0,
                    });

                    const items: SearchContentHit[] = matches.map((m) => ({
                        sermonId: m.sermonId,
                        translationId: m.translationId,
                        title: m.title,
                        location:
                            referenceDataService.getSermonMeta(m.translationId, lang, m.sermonId)
                                ?.location || undefined,
                        matches: m.snippets.slice(0, 5).map((p) => ({
                            paragraphNumber: p.paragraphIndex,
                            snippet: p.snippet,
                        })),
                        totalMatches: m.snippets.length,
                    }));

                    return { results: items, totalSermons: total };
                } catch (err) {
                    return {
                        error: `Full-text search failed: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
            },
        },
    };
}
