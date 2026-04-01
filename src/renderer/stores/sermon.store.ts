import { create } from 'zustand';
import type {
    DocumentHtmlTree,
    DocumentTab,
    DocumentType,
    ParagraphReference,
    SermonContent,
    SermonMetaWithTraductions,
} from '@shared/types';
import { getTabKey, tabMatches } from '@shared/types';
import { getSermonYear } from '@renderer/utils/sermon-utils';
import { useAppStore } from './app.store';

type SermonPendingNavigationTarget = {
    documentType: 'sermon';
    sermonId: string;
    translationId?: number;
    bibleBook?: never;
    bibleChapter?: never;
    bibleVersionAbbreviation?: never;
    customDocumentId?: never;
};

type BiblePendingNavigationTarget = {
    documentType: 'bible';
    sermonId: string;
    bibleBook?: string;
    bibleChapter?: string;
    bibleVersionAbbreviation?: string;
    translationId?: never;
    customDocumentId?: never;
};

type CustomPendingNavigationTarget = {
    documentType: 'custom';
    sermonId: string;
    customDocumentId?: string;
    translationId?: never;
    bibleBook?: never;
    bibleChapter?: never;
    bibleVersionAbbreviation?: never;
};

export type PendingNavigationTarget =
    | SermonPendingNavigationTarget
    | BiblePendingNavigationTarget
    | CustomPendingNavigationTarget;

export type PendingNavigation = {
    target: PendingNavigationTarget;
    documentHtmlTree: DocumentHtmlTree | ParagraphReference;
} | null;

interface SermonState {
    sermons: SermonMetaWithTraductions[];
    sermonsById: Record<string, SermonMetaWithTraductions>;
    sermonsByYear: Record<string, SermonMetaWithTraductions[]>;
    activeContent: SermonContent | null;
    tabs: DocumentTab[];
    pendingNavigation: PendingNavigation;
    error: string | null;

    setSermons(s: SermonMetaWithTraductions[]): void;
    setActiveContent(c: SermonContent | null): void;
    setPendingNavigation(nav: PendingNavigation): void;
    setTabs(tabs: DocumentTab[]): void;
    setError(error: string | null): void;
    addTab(
        title: string,
        documentId: string,
        type?: DocumentType,
        languageCode?: string,
        translationId?: number,
        bibleBook?: string,
        bibleChapter?: string,
    ): void;
    removeTab(key: string): void;
    activateTab(key: string): void;
    removeOtherTabs(key: string): void;
    removeTabsToRight(key: string): void;
    removeAllTabs(): void;
    reorderTabs(tabs: DocumentTab[]): void;
    updateTabScroll(key: string, scrollY?: number, scrollX?: number): void;
    updateTabZoom(key: string, zoom: number): void;
    updateTabTranslationId(key: string, translationId: number): void;
    updateBibleTab(
        key: string,
        title: string,
        documentId: string,
        bibleBook: string,
        bibleChapter: string,
    ): void;
}

const matchKey = (t: DocumentTab, key: string) => getTabKey(t) === key;

export const useSermonStore = create<SermonState>((set) => ({
    sermons: [],
    sermonsById: {},
    sermonsByYear: {},
    activeContent: null,
    tabs: [],
    pendingNavigation: null,
    error: null,

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
    setError: (error) => set({ error }),

    addTab: (title, documentId, type, languageCode, translationId, bibleBook, bibleChapter) =>
        set((s) => {
            const tabType = type ?? 'sermon';
            const exists = s.tabs.some(
                (t) => tabMatches(t, title, documentId) && (t.type ?? 'sermon') === tabType,
            );
            if (exists) {
                return {
                    tabs: s.tabs.map((t) => {
                        const isMatch =
                            tabMatches(t, title, documentId) && (t.type ?? 'sermon') === tabType;
                        return {
                            ...t,
                            active: isMatch,
                            ...(isMatch && translationId != null ? { translationId } : {}),
                        };
                    }),
                };
            }

            const deactivated = s.tabs.map((t) => ({ ...t, active: false }));

            const newTab: DocumentTab = { title, active: true, type: tabType, documentId };
            if (languageCode) newTab.languageCode = languageCode;
            if (translationId != null) newTab.translationId = translationId;
            if (bibleBook) newTab.bibleBook = bibleBook;
            if (bibleChapter) newTab.bibleChapter = bibleChapter;

            let newTabs = [...deactivated, newTab];

            // Enforce max tabs limit — remove oldest (first) tabs when over the limit
            const maxTabs = useAppStore.getState().maxTabs;
            if (newTabs.length > maxTabs) {
                newTabs = newTabs.slice(newTabs.length - maxTabs);
            }

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

    updateBibleTab: (key, title, documentId, bibleBook, bibleChapter) =>
        set((s) => ({
            tabs: s.tabs.map((t) =>
                matchKey(t, key)
                    ? { ...t, title, documentId, bibleBook, bibleChapter, scrollY: 0 }
                    : t,
            ),
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

export function selectActiveTabType(state: SermonState): DocumentType {
    const active = state.tabs.find((t) => t.active);
    return active?.type ?? 'sermon';
}
