import type { z } from 'zod';
import type { CustomDocumentSearchHit, SearchMode } from '@shared/types';

export interface AiToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
    description: string;
    inputSchema: TSchema;
    // Tool executors are invoked by the AI SDK after schema validation.
    // Keeping `any` here preserves ergonomic destructuring across the tool registry.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: (input: any) => Promise<unknown> | unknown;
}

// ---------------------------------------------------------------------------
// Sermon tool response types
// ---------------------------------------------------------------------------

export interface SermonSearchResult {
    sermonId: string;
    translationId: number;
    languageCode: string;
    title: string;
    enTitle?: string;
    dateMs: number;
    location?: string;
}

export interface SermonContentMeta {
    sermonId: string;
    translationId: number;
    languageCode: string;
    title: string;
    dateMs: number;
}

export interface SermonParagraphResult {
    paragraphNumber: number;
    content: string;
    wmbUrl: string;
}

export interface SermonContentResponse {
    meta: SermonContentMeta;
    paragraphs: SermonParagraphResult[];
    totalParagraphs: number;
    startParagraph: number;
    requestedTranslationId?: number;
    resolvedTranslationId?: number;
    fallbackTranslationId?: number;
    translationWarning?: string;
}

export interface SearchContentMatch {
    paragraphNumber: number;
    snippet: string;
    wmbUrl: string;
}

export interface SearchContentHit {
    sermonId: string;
    translationId: number;
    languageCode: string;
    title: string;
    location?: string;
    matches: SearchContentMatch[];
    totalMatches: number;
}

export interface PaginatedToolResult {
    returned: number;
    hasMore: boolean;
    nextCursor?: string;
}

export interface SermonSearchToolResponse extends PaginatedToolResult {
    results: SermonSearchResult[];
    total: number;
}

export interface SearchContentToolResponse extends PaginatedToolResult {
    results: SearchContentHit[];
    totalSermons: number;
    totalIsExact: boolean;
}

export interface CustomDocumentSearchToolResponse extends PaginatedToolResult {
    results: CustomDocumentSearchHit[];
    totalDocuments: number;
    mode: SearchMode;
    query: string;
}

// ---------------------------------------------------------------------------
// Bible tool response types
// ---------------------------------------------------------------------------

export interface BibleVersionOption {
    abbreviation: string;
    languageCode: string;
    name: string;
}

export interface BibleVerseResult {
    bookCode: string;
    bookName: string;
    chapter: string;
    verse: string;
    testament: string;
    bibleVersionAbbreviation: string;
    content: string;
    wmbUrl: string;
}

export interface BiblePassageToolResponse {
    bookCode: string;
    bookName: string;
    chapter: string;
    fromVerse: string;
    toVerse: string;
    bibleVersionAbbreviation: string;
    verseCount: number;
    verses: BibleVerseResult[];
}

export interface BibleSearchToolResponse {
    query: string;
    bibleVersionAbbreviation: string;
    total: number;
    returned: number;
    hasMore: boolean;
    results: BibleVerseResult[];
}
