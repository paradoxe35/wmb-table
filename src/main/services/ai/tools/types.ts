import type { z } from 'zod';

export interface AiToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
    description: string;
    inputSchema: TSchema;
    execute: (input: any) => Promise<unknown> | unknown;
}

// ---------------------------------------------------------------------------
// Sermon tool response types
// ---------------------------------------------------------------------------

export interface SermonSearchResult {
    sermonId: string;
    translationId: number;
    title: string;
    enTitle?: string;
    dateMs: number;
    location?: string;
}

export interface SermonContentMeta {
    sermonId: string;
    translationId: number;
    title: string;
    dateMs: number;
}

export interface SermonParagraphResult {
    paragraphNumber: number;
    content: string;
}

export interface SermonContentResponse {
    meta: SermonContentMeta;
    paragraphs: SermonParagraphResult[];
    totalParagraphs: number;
    startParagraph: number;
}

export interface SearchContentMatch {
    paragraphNumber: number;
    snippet: string;
}

export interface SearchContentHit {
    sermonId: string;
    translationId: number;
    title: string;
    location?: string;
    matches: SearchContentMatch[];
    totalMatches: number;
}
