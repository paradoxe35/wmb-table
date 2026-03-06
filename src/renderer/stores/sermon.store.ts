import { create } from 'zustand';
import type {
    DocumentHtmlTree,
    DocumentTab,
    ParagraphReference,
    SermonContent,
    SermonMetaWithTraductions,
} from '@shared/types';
import { getTabKey, tabMatches } from '@shared/types';
import { getSermonYear } from '@renderer/utils/sermon-utils';

export type PendingNavigation = {
    documentTitle: string;
    documentHtmlTree: DocumentHtmlTree | ParagraphReference;
} | null;

interface SermonState {
    sermons: SermonMetaWithTraductions[];
    sermonsById: Record<string, SermonMetaWithTraductions>;
    sermonsByYear: Record<string, SermonMetaWithTraductions[]>;
    activeContent: SermonContent | null;
    tabs: DocumentTab[];
    pendingNavigation: PendingNavigation;

    setSermons(s: SermonMetaWithTraductions[]): void;
    setActiveContent(c: SermonContent | null): void;
    setPendingNavigation(nav: PendingNavigation): void;
    setTabs(tabs: DocumentTab[]): void;
    addTab(title: string, sermonId: string, type?: 'sermon' | 'custom'): void;
    removeTab(key: string): void;
    activateTab(key: string): void;
    removeOtherTabs(key: string): void;
    removeTabsToRight(key: string): void;
    removeAllTabs(): void;
    reorderTabs(tabs: DocumentTab[]): void;
    updateTabScroll(key: string, scrollY?: number, scrollX?: number): void;
    updateTabZoom(key: string, zoom: number): void;
    updateTabTranslationId(key: string, translationId: number): void;
}

const matchKey = (t: DocumentTab, key: string) => getTabKey(t) === key;

export const useSermonStore = create<SermonState>((set) => ({
    sermons: [],
    sermonsById: {},
    sermonsByYear: {},
    activeContent: null,
    tabs: [],
    pendingNavigation: null,

    setSermons: (s) => {
        const sermonsById: Record<string, SermonMetaWithTraductions> = {};
        const sermonsByYear: Record<string, SermonMetaWithTraductions[]> = {};
        for (const sermon of s) {
            sermonsById[sermon.sermonId] = sermon;
            const year = getSermonYear(sermon);
            if (year) {
                if (!sermonsByYear[year]) sermonsByYear[year] = [];
                sermonsByYear[year].push(sermon);
            }
        }
        set({ sermons: s, sermonsById, sermonsByYear });
    },

    setActiveContent: (c) => set({ activeContent: c }),
    setPendingNavigation: (nav) => set({ pendingNavigation: nav }),
    setTabs: (tabs) => set({ tabs }),

    addTab: (title, sermonId, type) =>
        set((s) => {
            const tabType = type ?? 'sermon';
            const exists = s.tabs.some(
                (t) => tabMatches(t, title, sermonId) && (t.type ?? 'sermon') === tabType,
            );
            if (exists) {
                return {
                    tabs: s.tabs.map((t) => ({
                        ...t,
                        active: tabMatches(t, title, sermonId) && (t.type ?? 'sermon') === tabType,
                    })),
                };
            }
            const deactivated = s.tabs.map((t) => ({ ...t, active: false }));
            const newTabs = [...deactivated, { title, active: true, type: tabType, sermonId }];
            return { tabs: newTabs };
        }),

    removeTab: (key) =>
        set((s) => {
            const idx = s.tabs.findIndex((t) => matchKey(t, key));
            const wasActive = idx >= 0 && s.tabs[idx].active;
            const filtered = s.tabs.filter((t) => !matchKey(t, key));
            if (wasActive && filtered.length > 0) {
                const nextIdx = Math.min(idx, filtered.length - 1);
                filtered[nextIdx] = { ...filtered[nextIdx], active: true };
            }
            return { tabs: filtered };
        }),

    removeOtherTabs: (key) =>
        set((s) => {
            const tab = s.tabs.find((t) => matchKey(t, key));
            return tab ? { tabs: [{ ...tab, active: true }] } : {};
        }),

    removeTabsToRight: (key) =>
        set((s) => {
            const idx = s.tabs.findIndex((t) => matchKey(t, key));
            if (idx < 0) return {};
            const kept = s.tabs.slice(0, idx + 1);
            if (!kept.some((t) => t.active)) {
                kept[kept.length - 1] = { ...kept[kept.length - 1], active: true };
            }
            return { tabs: kept };
        }),

    removeAllTabs: () => set({ tabs: [] }),

    activateTab: (key) =>
        set((s) => ({
            tabs: s.tabs.map((t) => ({ ...t, active: matchKey(t, key) })),
        })),

    reorderTabs: (tabs) => set({ tabs }),

    updateTabScroll: (key, scrollY, scrollX) =>
        set((s) => ({
            tabs: s.tabs.map((t) => (matchKey(t, key) ? { ...t, scrollY, scrollX } : t)),
        })),

    updateTabZoom: (key, zoom) =>
        set((s) => ({
            tabs: s.tabs.map((t) => (matchKey(t, key) ? { ...t, zoom } : t)),
        })),

    updateTabTranslationId: (key, translationId) =>
        set((s) => ({
            tabs: s.tabs.map((t) => (matchKey(t, key) ? { ...t, translationId } : t)),
        })),
}));

export function selectActiveTabTitle(state: SermonState): string | null {
    const active = state.tabs.find((t) => t.active);
    return active?.title ?? state.sermons[0]?.title ?? null;
}

export function selectActiveTabKey(state: SermonState): string | null {
    const active = state.tabs.find((t) => t.active);
    return active ? getTabKey(active) : null;
}

export function selectActiveTab(state: SermonState): DocumentTab | null {
    return state.tabs.find((t) => t.active) ?? null;
}

export function selectActiveTabType(state: SermonState): 'sermon' | 'custom' {
    const active = state.tabs.find((t) => t.active);
    return active?.type ?? 'sermon';
}
