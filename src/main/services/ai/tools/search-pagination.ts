import { z } from 'zod';
import type { SearchMode } from '@shared/types';

const SEARCH_LIMIT_SCHEMA = z.number().int().min(1).max(20);

const sermonSearchCursorSchema = z.object({
    kind: z.literal('searchSermons'),
    query: z.string().min(1),
    languageCode: z.string().min(1),
    limit: SEARCH_LIMIT_SCHEMA,
    offset: z.number().int().min(0),
});

const contentSearchCursorSchema = z.object({
    kind: z.literal('searchContent'),
    query: z.string().min(2),
    languageCode: z.string().min(1),
    mode: z.enum(['exact', 'all', 'any']),
    limit: SEARCH_LIMIT_SCHEMA,
    offset: z.number().int().min(0),
});

type SermonSearchCursor = z.infer<typeof sermonSearchCursorSchema>;
type ContentSearchCursor = z.infer<typeof contentSearchCursorSchema>;

export const toolSearchLimitSchema = SEARCH_LIMIT_SCHEMA.optional();

const sermonSearchInputSchema = z
    .object({
        query: z.string().min(1).optional(),
        languageCode: z.string().optional(),
        limit: toolSearchLimitSchema,
        cursor: z.string().min(1).optional(),
    })
    .refine((value) => Boolean(value.query || value.cursor), {
        message: 'Either query or cursor is required.',
        path: ['query'],
    });

const contentSearchInputSchema = z
    .object({
        query: z.string().min(2).optional(),
        languageCode: z.string().optional(),
        mode: z.enum(['exact', 'all', 'any']).optional(),
        limit: toolSearchLimitSchema,
        cursor: z.string().min(1).optional(),
    })
    .refine((value) => Boolean(value.query || value.cursor), {
        message: 'Either query or cursor is required.',
        path: ['query'],
    });

export const sermonSearchToolInputSchema = sermonSearchInputSchema;
export const contentSearchToolInputSchema = contentSearchInputSchema;

export interface ResolvedSermonSearchPage {
    query: string;
    languageCode: string;
    limit: number;
    offset: number;
}

export interface ResolvedContentSearchPage extends ResolvedSermonSearchPage {
    mode: SearchMode;
}

function normalizeRequiredQuery(
    query: string | undefined,
    minimumLength: number,
): string | undefined {
    const normalized = query?.trim() ?? '';
    return normalized.length >= minimumLength ? normalized : undefined;
}

function encodeCursorPayload(payload: SermonSearchCursor | ContentSearchCursor): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursorPayload(cursor: string): unknown {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
}

function parseCursor<T>(
    cursor: string,
    schema: z.ZodSchema<T>,
): { value: T } | { error: { error: string } } {
    try {
        const parsed = schema.safeParse(decodeCursorPayload(cursor));
        if (!parsed.success) {
            return { error: { error: 'Invalid pagination cursor.' } };
        }
        return { value: parsed.data };
    } catch {
        return { error: { error: 'Invalid pagination cursor.' } };
    }
}

function ensureSameField<T extends string | number>(
    label: string,
    explicitValue: T | undefined,
    cursorValue: T,
): { error: string } | null {
    if (explicitValue === undefined || explicitValue === cursorValue) {
        return null;
    }
    return { error: `The provided ${label} does not match the pagination cursor.` };
}

export function resolveSermonSearchPage(input: {
    query?: string;
    languageCode?: string;
    limit?: number;
    cursor?: string;
    defaultLanguageCode: string;
    defaultLimit: number;
}): ResolvedSermonSearchPage | { error: string } {
    const limit = input.limit ?? input.defaultLimit;

    if (!input.cursor) {
        const query = normalizeRequiredQuery(input.query, 1);
        if (!query) {
            return { error: 'A query is required when no cursor is provided.' };
        }
        return {
            query,
            languageCode: input.languageCode ?? input.defaultLanguageCode,
            limit,
            offset: 0,
        };
    }

    const parsed = parseCursor(input.cursor, sermonSearchCursorSchema);
    if ('error' in parsed) return parsed.error;

    const cursor = parsed.value;
    const queryError = ensureSameField(
        'query',
        normalizeRequiredQuery(input.query, 1),
        cursor.query,
    );
    if (queryError) return queryError;
    const languageError = ensureSameField('languageCode', input.languageCode, cursor.languageCode);
    if (languageError) return languageError;
    const limitError = ensureSameField('limit', input.limit, cursor.limit);
    if (limitError) return limitError;

    return {
        query: cursor.query,
        languageCode: cursor.languageCode,
        limit: cursor.limit,
        offset: cursor.offset,
    };
}

export function resolveContentSearchPage(input: {
    query?: string;
    languageCode?: string;
    mode?: SearchMode;
    limit?: number;
    cursor?: string;
    defaultLanguageCode: string;
    defaultLimit: number;
    defaultMode: SearchMode;
}): ResolvedContentSearchPage | { error: string } {
    const limit = input.limit ?? input.defaultLimit;
    const mode = input.mode ?? input.defaultMode;

    if (!input.cursor) {
        const query = normalizeRequiredQuery(input.query, 2);
        if (!query) {
            return { error: 'A query is required when no cursor is provided.' };
        }
        return {
            query,
            languageCode: input.languageCode ?? input.defaultLanguageCode,
            mode,
            limit,
            offset: 0,
        };
    }

    const parsed = parseCursor(input.cursor, contentSearchCursorSchema);
    if ('error' in parsed) return parsed.error;

    const cursor = parsed.value;
    const queryError = ensureSameField(
        'query',
        normalizeRequiredQuery(input.query, 2),
        cursor.query,
    );
    if (queryError) return queryError;
    const languageError = ensureSameField('languageCode', input.languageCode, cursor.languageCode);
    if (languageError) return languageError;
    const modeError = ensureSameField('mode', input.mode, cursor.mode);
    if (modeError) return modeError;
    const limitError = ensureSameField('limit', input.limit, cursor.limit);
    if (limitError) return limitError;

    return {
        query: cursor.query,
        languageCode: cursor.languageCode,
        mode: cursor.mode,
        limit: cursor.limit,
        offset: cursor.offset,
    };
}

export function buildNextSermonSearchCursor(
    page: ResolvedSermonSearchPage,
    returned: number,
): string {
    return encodeCursorPayload({
        kind: 'searchSermons',
        query: page.query,
        languageCode: page.languageCode,
        limit: page.limit,
        offset: page.offset + returned,
    });
}

export function buildNextContentSearchCursor(
    page: ResolvedContentSearchPage,
    returned: number,
): string {
    return encodeCursorPayload({
        kind: 'searchContent',
        query: page.query,
        languageCode: page.languageCode,
        mode: page.mode,
        limit: page.limit,
        offset: page.offset + returned,
    });
}
