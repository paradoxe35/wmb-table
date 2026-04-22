import { beforeEach, describe, expect, it } from 'vitest';
import type { SermonListItemWithTranslations } from '@shared/types';
import { getSermonDerivedCollections, useSermonStore } from '@renderer/stores/sermon.store';

const sermons: SermonListItemWithTranslations[] = [
    {
        translationId: 1,
        languageCode: 'fr',
        sermonId: '63-0101',
        title: 'Premier sermon',
        enTitle: 'Premier sermon',
        hasAudio: false,
        dateMs: new Date('1963-01-01T00:00:00.000Z').getTime(),
        location: null,
        cityState: null,
        availableTranslations: [
            {
                translationId: 1,
                languageCode: 'fr',
                title: 'Premier sermon',
            },
        ],
    },
    {
        translationId: 2,
        languageCode: 'fr',
        sermonId: '63-0201',
        title: 'Deuxième sermon',
        enTitle: 'Deuxième sermon',
        hasAudio: true,
        dateMs: new Date('1963-02-01T00:00:00.000Z').getTime(),
        location: 'Jeffersonville',
        cityState: 'Jeffersonville, IN',
        availableTranslations: [
            {
                translationId: 2,
                languageCode: 'fr',
                title: 'Deuxième sermon',
            },
        ],
    },
    {
        translationId: 3,
        languageCode: 'fr',
        sermonId: '64-0101',
        title: 'Troisième sermon',
        enTitle: 'Troisième sermon',
        hasAudio: false,
        dateMs: new Date('1964-01-01T00:00:00.000Z').getTime(),
        location: null,
        cityState: null,
        availableTranslations: [
            {
                translationId: 3,
                languageCode: 'fr',
                title: 'Troisième sermon',
            },
        ],
    },
];

beforeEach(() => {
    useSermonStore.setState({
        sermons: [],
        activeContent: null,
        error: null,
    });
});

describe('sermon.store', () => {
    it('keeps only the canonical sermon list in store state', () => {
        useSermonStore.getState().setSermons(sermons);

        expect(useSermonStore.getState().sermons).toEqual(sermons);
    });

    it('derives id and year collections from the stored sermons', () => {
        useSermonStore.getState().setSermons(sermons);

        const storedSermons = useSermonStore.getState().sermons;
        const derived = getSermonDerivedCollections(storedSermons);

        expect(derived.sermonsById['63-0101']).toBe(storedSermons[0]);
        expect(derived.sermonsById['64-0101']).toBe(storedSermons[2]);
        expect(derived.sermonsByYear['1963']).toEqual([storedSermons[0], storedSermons[1]]);
        expect(derived.sermonsByYear['1964']).toEqual([storedSermons[2]]);
        expect(getSermonDerivedCollections(storedSermons)).toBe(derived);
    });
});
