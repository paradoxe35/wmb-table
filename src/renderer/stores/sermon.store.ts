import { create } from 'zustand';
import type { SermonContent, SermonMetaWithTraductions } from '@shared/types';
import { getSermonYear } from '@renderer/utils/sermon-utils';

interface SermonState {
    sermons: SermonMetaWithTraductions[];
    sermonsById: Record<string, SermonMetaWithTraductions>;
    sermonsByYear: Record<string, SermonMetaWithTraductions[]>;
    activeContent: SermonContent | null;
    error: string | null;

    setSermons(s: SermonMetaWithTraductions[]): void;
    setActiveContent(c: SermonContent | null): void;
    setError(error: string | null): void;
}

export const useSermonStore = create<SermonState>((set) => ({
    sermons: [],
    sermonsById: {},
    sermonsByYear: {},
    activeContent: null,
    error: null,

    setSermons: (sermons) => {
        const sermonsById: Record<string, SermonMetaWithTraductions> = {};
        const sermonsByYear: Record<string, SermonMetaWithTraductions[]> = {};

        for (const sermon of sermons) {
            sermonsById[sermon.sermonId] = sermon;
            const year = getSermonYear(sermon);
            if (!year) continue;
            if (!sermonsByYear[year]) sermonsByYear[year] = [];
            sermonsByYear[year].push(sermon);
        }

        set({ sermons, sermonsById, sermonsByYear });
    },

    setActiveContent: (activeContent) => set({ activeContent }),
    setError: (error) => set({ error }),
}));
