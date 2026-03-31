import { describe, expect, it } from 'vitest';
import {
    buildNextContentSearchCursor,
    buildNextSermonSearchCursor,
    resolveContentSearchPage,
    resolveSermonSearchPage,
} from '@main/services/ai/tools/search-pagination';

describe('ai tool search pagination', () => {
    it('continues content search deterministically with nextCursor', () => {
        const firstPage = resolveContentSearchPage({
            query: 'Dieu a dit',
            defaultLanguageCode: 'fr',
            defaultLimit: 10,
            defaultMode: 'exact',
        });

        if ('error' in firstPage) {
            throw new Error(firstPage.error);
        }

        expect(firstPage).toMatchObject({
            query: 'Dieu a dit',
            languageCode: 'fr',
            mode: 'exact',
            limit: 10,
            offset: 0,
        });

        const cursor = buildNextContentSearchCursor(firstPage, 10);
        const nextPage = resolveContentSearchPage({
            cursor,
            defaultLanguageCode: 'fr',
            defaultLimit: 10,
            defaultMode: 'exact',
        });

        if ('error' in nextPage) {
            throw new Error(nextPage.error);
        }

        expect(nextPage).toMatchObject({
            query: 'Dieu a dit',
            languageCode: 'fr',
            mode: 'exact',
            limit: 10,
            offset: 10,
        });
    });

    it('rejects conflicting content-search inputs when cursor is reused', () => {
        const firstPage = resolveContentSearchPage({
            query: 'Dieu a dit',
            defaultLanguageCode: 'fr',
            defaultLimit: 10,
            defaultMode: 'all',
        });

        if ('error' in firstPage) {
            throw new Error(firstPage.error);
        }

        const cursor = buildNextContentSearchCursor(firstPage, 10);
        expect(
            resolveContentSearchPage({
                cursor,
                query: 'autre chose',
                defaultLanguageCode: 'fr',
                defaultLimit: 10,
                defaultMode: 'all',
            }),
        ).toEqual({
            error: 'The provided query does not match the pagination cursor.',
        });
    });

    it('continues sermon metadata search deterministically with nextCursor', () => {
        const firstPage = resolveSermonSearchPage({
            query: 'Message',
            defaultLanguageCode: 'fr',
            defaultLimit: 5,
        });

        if ('error' in firstPage) {
            throw new Error(firstPage.error);
        }

        const cursor = buildNextSermonSearchCursor(firstPage, 5);
        const nextPage = resolveSermonSearchPage({
            cursor,
            defaultLanguageCode: 'fr',
            defaultLimit: 5,
        });

        if ('error' in nextPage) {
            throw new Error(nextPage.error);
        }

        expect(nextPage).toMatchObject({
            query: 'Message',
            languageCode: 'fr',
            limit: 5,
            offset: 5,
        });
    });
});
