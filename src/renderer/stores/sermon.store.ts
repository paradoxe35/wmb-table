import { create } from 'zustand';
import type {
    DocumentHtmlTree,
    DocumentTab,
    ParagraphReference,
    SermonContent,
    SermonMetaWithTraductions,
} from '@shared/types';
import { getSermonYear } from '@renderer/utils/sermon-utils';

export type PendingNavigation = {
    documentTitle: string;
    documentHtmlTree: DocumentHtmlTree | ParagraphReference;
} | null;

interface SermonState {
    sermons: SermonMetaWithTraductions[];
    sermonsByTitle: Record<string, SermonMetaWithTraductions>;
    sermonsByYear: Record<string, SermonMetaWithTraductions[]>;
    activeContent: SermonContent | null;
    tabs: DocumentTab[];
    pendingNavigation: PendingNavigation;

    setSermons(s: SermonMetaWithTraductions[]): void;
    setActiveContent(c: SermonContent | null): void;
    setPendingNavigation(nav: PendingNavigation): void;
    setTabs(tabs: DocumentTab[]): void;
    addTab(title: string, type?: 'sermon' | 'custom'): void;
    removeTab(title: string): void;
    activateTab(title: string): void;
    removeOtherTabs(title: string): void;
    removeTabsToRight(title: string): void;
    removeAllTabs(): void;
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
    pendingNavigation: null,

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
    setPendingNavigation: (nav) => set({ pendingNavigation: nav }),
    setTabs: (tabs) => set({ tabs }),

    addTab: (title, type) =>
        set((s) => {
            const tabType = type ?? 'sermon';
            const exists = s.tabs.some(
                (t) => t.title === title && (t.type ?? 'sermon') === tabType,
            );
            if (exists) {
                return {
                    tabs: s.tabs.map((t) => ({
                        ...t,
                        active: t.title === title && (t.type ?? 'sermon') === tabType,
                    })),
                };
            }
            const deactivated = s.tabs.map((t) => ({ ...t, active: false }));
            const newTabs = [...deactivated, { title, active: true, type: tabType }];
            return { tabs: newTabs };
        }),

    removeTab: (title) =>
        set((s) => {
            const idx = s.tabs.findIndex((t) => t.title === title);
            const wasActive = idx >= 0 && s.tabs[idx].active;
            const filtered = s.tabs.filter((t) => t.title !== title);
            if (wasActive && filtered.length > 0) {
                const nextIdx = Math.min(idx, filtered.length - 1);
                filtered[nextIdx] = { ...filtered[nextIdx], active: true };
            }
            return { tabs: filtered };
        }),

    removeOtherTabs: (title) =>
        set((s) => {
            const tab = s.tabs.find((t) => t.title === title);
            return tab ? { tabs: [{ ...tab, active: true }] } : {};
        }),

    removeTabsToRight: (title) =>
        set((s) => {
            const idx = s.tabs.findIndex((t) => t.title === title);
            if (idx < 0) return {};
            const kept = s.tabs.slice(0, idx + 1);
            if (!kept.some((t) => t.active)) {
                kept[kept.length - 1] = { ...kept[kept.length - 1], active: true };
            }
            return { tabs: kept };
        }),

    removeAllTabs: () => set({ tabs: [] }),

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

export function selectActiveTabType(state: SermonState): 'sermon' | 'custom' {
    const active = state.tabs.find((t) => t.active);
    return active?.type ?? 'sermon';
}
