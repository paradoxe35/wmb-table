import { z } from 'zod';
import * as referenceRepo from '@main/database/repositories/reference.repository';
import * as referenceDataService from '@main/services/reference-data.service';
import * as tantivyService from '@main/services/tantivy.service';
import type { AiToolDefinition } from './types';
import { inferTranslationId } from './shared';

export function buildSermonTools(defaultLanguageCode: string): Record<string, AiToolDefinition> {
    return {
        searchSermons: {
            description: 'Search sermons by title, date, sermon id, town, state, or location.',
            inputSchema: z.object({
                query: z.string().min(1),
                languageCode: z.string().optional(),
                limit: z.number().int().min(1).max(20).optional(),
            }),
            execute: async ({ query, languageCode, limit = 8 }) => {
                const normalized = query.toLowerCase();
                return referenceDataService
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
                            .some((value) => {
                                return value!.toLowerCase().includes(normalized);
                            });
                    })
                    .slice(0, limit);
            },
        },
        getSermonContent: {
            description: 'Retrieve sermon paragraphs for a sermon id in a language.',
            inputSchema: z.object({
                sermonId: z.string(),
                languageCode: z.string().optional(),
                translationId: z.number().int().optional(),
                maxParagraphs: z.number().int().min(1).max(40).optional(),
            }),
            execute: async ({ sermonId, languageCode, translationId, maxParagraphs = 12 }) => {
                const lang = languageCode ?? defaultLanguageCode;
                const meta =
                    referenceDataService.getSermonMeta(
                        translationId ?? inferTranslationId(sermonId, lang),
                        lang,
                        sermonId,
                    ) ??
                    referenceDataService.getSermonListForLanguage(lang).find((sermon) => {
                        return sermon.sermonId === sermonId;
                    });
                if (!meta) return null;

                const paragraphs = await tantivyService.getSermonParagraphs(
                    lang,
                    meta.translationId,
                    meta.dateMs,
                );
                return {
                    meta,
                    paragraphs: paragraphs.slice(0, maxParagraphs),
                    totalParagraphs: paragraphs.length,
                };
            },
        },
        searchContent: {
            description: 'Search sermon content full-text and return snippets.',
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
                    const snippet = await tantivyService.getSearchSnippet(
                        lang,
                        query,
                        hit.bestDocAddress,
                    );
                    items.push({ sermonId, meta, snippet, paragraphIndex: hit.bestParagraphIndex });
                }
                return items;
            },
        },
    };
}
