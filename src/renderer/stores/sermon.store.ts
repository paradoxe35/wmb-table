import type { SermonContent, SermonMetaWithTranslations } from '@shared/types';
import { getSermonYear } from '@renderer/utils/sermon-utils';
import { createStore } from './create-store';

interface SermonState {
    sermons: SermonMetaWithTranslations[];
    sermonsById: Record<string, SermonMetaWithTranslations>;
    sermonsByYear: Record<string, SermonMetaWithTranslations[]>;
    activeContent: SermonContent | null;
    error: string | null;

    setSermons(s: SermonMetaWithTranslations[]): void;
    setActiveContent(c: SermonContent | null): void;
    setError(error: string | null): void;
}

export const useSermonStore = createStore<SermonState>((set) => ({
    sermons: [],
    sermonsById: {},
    sermonsByYear: {},
    activeContent: null,
    error: null,

    setSermons: (sermons) => {
        const sermonsById: Record<string, SermonMetaWithTranslations> = {};
        const sermonsByYear: Record<string, SermonMetaWithTranslations[]> = {};

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
