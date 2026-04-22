import { useMemo } from 'react';
import type { SermonContent, SermonMetaWithTranslations } from '@shared/types';
import { getSermonYear } from '@renderer/utils/sermon-utils';
import { createStore } from './create-store';

export type SermonDerivedCollections = {
    sermonsById: Record<string, SermonMetaWithTranslations>;
    sermonsByYear: Record<string, SermonMetaWithTranslations[]>;
};

let cachedSermonsRef: SermonMetaWithTranslations[] | null = null;
let cachedDerivedCollections: SermonDerivedCollections = {
    sermonsById: {},
    sermonsByYear: {},
};

export function getSermonDerivedCollections(
    sermons: SermonMetaWithTranslations[],
): SermonDerivedCollections {
    if (sermons === cachedSermonsRef) {
        return cachedDerivedCollections;
    }

    const sermonsById: Record<string, SermonMetaWithTranslations> = {};
    const sermonsByYear: Record<string, SermonMetaWithTranslations[]> = {};

    for (const sermon of sermons) {
        sermonsById[sermon.sermonId] = sermon;
        const year = getSermonYear(sermon);
        if (!year) continue;
        if (!sermonsByYear[year]) sermonsByYear[year] = [];
        sermonsByYear[year].push(sermon);
    }

    cachedSermonsRef = sermons;
    cachedDerivedCollections = {
        sermonsById,
        sermonsByYear,
    };

    return cachedDerivedCollections;
}

export function useSermonDerivedCollections(): SermonDerivedCollections {
    const sermons = useSermonStore((s) => s.sermons);
    return useMemo(() => getSermonDerivedCollections(sermons), [sermons]);
}

export function useSermonsById(): Record<string, SermonMetaWithTranslations> {
    return useSermonDerivedCollections().sermonsById;
}

export function useSermonsByYear(): Record<string, SermonMetaWithTranslations[]> {
    return useSermonDerivedCollections().sermonsByYear;
}

interface SermonState {
    sermons: SermonMetaWithTranslations[];
    activeContent: SermonContent | null;
    error: string | null;

    setSermons(s: SermonMetaWithTranslations[]): void;
    setActiveContent(c: SermonContent | null): void;
    setError(error: string | null): void;
}

export const useSermonStore = createStore<SermonState>((set) => ({
    sermons: [],
    activeContent: null,
    error: null,

    setSermons: (sermons) => set({ sermons }),

    setActiveContent: (activeContent) => set({ activeContent }),
    setError: (error) => set({ error }),
}));
