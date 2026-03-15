import { z } from 'zod';
import * as referenceRepo from '@main/database/repositories/reference.repository';
import * as referenceDataService from '@main/services/reference-data.service';
import * as tantivyService from '@main/services/tantivy.service';
import { strNormalize } from '@shared/searchable';
import type { AiToolDefinition } from './types';

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
                const normalized = strNormalize(query);
                const sermons = referenceDataService
                    .getSermonListForLanguage(languageCode ?? defaultLanguageCode)
                    .filter((sermon) => {
                        return [
                            sermon.title,
                            sermon.enTitle,
                            sermon.location,
                            sermon.cityState,
                            sermon.sermonId,
                            new Date(sermon.dateMs).toISOString().slice(0, 10),
                        ]
                            .filter(Boolean)
                            .some((value) => strNormalize(value!).includes(normalized));
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
                sermonId,
                languageCode,
                translationId,
                startParagraph = 0,
                maxParagraphs = 15,
            }) => {
                const lang = languageCode ?? defaultLanguageCode;

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
                    paragraphs: paragraphs.slice(startParagraph, startParagraph + maxParagraphs),
                    totalParagraphs: paragraphs.length,
                    startParagraph,
                };
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
                limit: z.number().int().min(1).max(10).optional(),
            }),
            execute: async ({ query, languageCode, limit = 5 }) => {
                const lang = languageCode ?? defaultLanguageCode;
                const result = await tantivyService.searchSermons(lang, query, limit, 0);
                const items = [];
                for (const hit of result.hits.slice(0, limit)) {
                    const sermonId = referenceRepo.tantivyDateToSermonIds(hit.tantivySermonDate)[0];
                    if (!sermonId) continue;
                    const meta = referenceDataService.getSermonMeta(
                        hit.translationId,
                        lang,
                        sermonId,
                    );
                    const matchingParagraphs = await tantivyService.getMatchingParagraphs(
                        lang,
                        query,
                        hit.translationId,
                        hit.tantivySermonDate,
                    );
                    items.push({
                        sermonId,
                        meta,
                        matchingParagraphs: matchingParagraphs.slice(0, 5),
                        totalMatches: matchingParagraphs.length,
                    });
                }
                return { results: items, totalSermons: result.total };
            },
        },
    };
}
