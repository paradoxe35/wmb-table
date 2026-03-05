import { create } from 'zustand';
import type { DocumentTab, SermonContent, SermonMetaWithTraductions } from '@shared/types';
import { getSermonYear } from '@renderer/utils/sermon-utils';

interface SermonState {
    sermons: SermonMetaWithTraductions[];
    sermonsByTitle: Record<string, SermonMetaWithTraductions>;
    sermonsByYear: Record<string, SermonMetaWithTraductions[]>;
    activeContent: SermonContent | null;
    tabs: DocumentTab[];

    setSermons(s: SermonMetaWithTraductions[]): void;
    setActiveContent(c: SermonContent | null): void;
    setTabs(tabs: DocumentTab[]): void;
    addTab(title: string): void;
    removeTab(title: string): void;
    activateTab(title: string): void;
    reorderTabs(tabs: DocumentTab[]): void;
    updateTabScroll(title: string, scrollY?: number, scrollX?: number): void;
    updateTabZoom(title: string, zoom: number): void;
    updateTabTranslationId(title: string, translationId: number): void;
}

export const useSermonStore = create<SermonState>((set) => ({
    sermons: [],
    sermonsByTitle: {},
    sermonsByYear: {},
    activeContent: null,
    tabs: [],

    setSermons: (s) => {
        const sermonsByTitle: Record<string, SermonMetaWithTraductions> = {};
        const sermonsByYear: Record<string, SermonMetaWithTraductions[]> = {};
        for (const sermon of s) {
            sermonsByTitle[sermon.title] = sermon;
            const year = getSermonYear(sermon);
            if (year) {
                if (!sermonsByYear[year]) sermonsByYear[year] = [];
                sermonsByYear[year].push(sermon);
            }
        }
        set({ sermons: s, sermonsByTitle, sermonsByYear });
    },

    setActiveContent: (c) => set({ activeContent: c }),
    setTabs: (tabs) => set({ tabs }),

    addTab: (title) =>
        set((s) => {
            const exists = s.tabs.some((t) => t.title === title);
            if (exists) {
                return {
                    tabs: s.tabs.map((t) => ({ ...t, active: t.title === title })),
                };
            }
            const deactivated = s.tabs.map((t) => ({ ...t, active: false }));
            const newTabs = [...deactivated, { title, active: true }];
            if (newTabs.length > 6) newTabs.shift();
            return { tabs: newTabs };
        }),

    removeTab: (title) =>
        set((s) => {
            const filtered = s.tabs.filter((t) => t.title !== title);
            const hasActive = filtered.some((t) => t.active);
            if (!hasActive && filtered.length > 0) {
                filtered[0].active = true;
            }
            return { tabs: filtered };
        }),

    activateTab: (title) =>
        set((s) => ({
            tabs: s.tabs.map((t) => ({ ...t, active: t.title === title })),
        })),

    reorderTabs: (tabs) => set({ tabs }),

    updateTabScroll: (title, scrollY, scrollX) =>
        set((s) => ({
            tabs: s.tabs.map((t) => (t.title === title ? { ...t, scrollY, scrollX } : t)),
        })),

    updateTabZoom: (title, zoom) =>
        set((s) => ({
            tabs: s.tabs.map((t) => (t.title === title ? { ...t, zoom } : t)),
        })),

    updateTabTranslationId: (title, translationId) =>
        set((s) => ({
            tabs: s.tabs.map((t) => (t.title === title ? { ...t, translationId } : t)),
        })),
}));

export function selectActiveTabTitle(state: SermonState): string | null {
    const active = state.tabs.find((t) => t.active);
    return active?.title ?? state.sermons[0]?.title ?? null;
}

export function selectActiveTab(state: SermonState): DocumentTab | null {
    return state.tabs.find((t) => t.active) ?? null;
}
