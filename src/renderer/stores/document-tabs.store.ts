import { create } from 'zustand';
import type {
    BibleTab,
    CustomTab,
    DocumentReference,
    DocumentIdentity,
    DocumentTab,
    SermonTab,
} from '@shared/types';
import {
    getDocumentIdentityFromTab,
    getTabKey,
    normalizeBibleAbbreviation,
    tabMatches,
} from '@shared/types';
import { useAppStore } from './app.store';

export type PendingNavigation = {
    target: DocumentIdentity;
    documentReference: DocumentReference;
} | null;

interface DocumentTabsState {
    tabs: DocumentTab[];
    pendingNavigation: PendingNavigation;

    setTabs(tabs: DocumentTab[]): void;
    setPendingNavigation(nav: PendingNavigation): void;
    addTab(tab: NewDocumentTab): void;
    removeTab(key: string): void;
    activateTab(key: string): void;
    removeOtherTabs(key: string): void;
    removeTabsToRight(key: string): void;
    removeAllTabs(): void;
    reorderTabs(tabs: DocumentTab[]): void;
    updateTabScroll(key: string, scrollY?: number, scrollX?: number): void;
    updateTabZoom(key: string, zoom: number): void;
    updateTabTranslationId(key: string, translationId: number): void;
    updateBibleTab(key: string, tab: BibleTabUpdate): void;
    updateBibleTabsVersion(bibleVersionAbbreviation: string): void;
}

const matchKey = (tab: DocumentTab, key: string) => getTabKey(tab) === key;

type NewSermonTab = Pick<
    SermonTab,
    'title' | 'documentId' | 'type' | 'languageCode' | 'translationId'
>;
type NewBibleTab = Pick<
    BibleTab,
    'title' | 'documentId' | 'type' | 'bibleBook' | 'bibleChapter' | 'bibleVersionAbbreviation'
>;
type NewCustomTab = Pick<CustomTab, 'title' | 'documentId' | 'type'>;
type NewDocumentTab = NewSermonTab | NewBibleTab | NewCustomTab;

type BibleTabUpdate = Pick<
    BibleTab,
    'title' | 'documentId' | 'bibleBook' | 'bibleChapter' | 'bibleVersionAbbreviation'
>;

function createTab(tab: NewDocumentTab): DocumentTab {
    if (tab.type === 'bible') {
        return {
            title: tab.title,
            active: true,
            type: 'bible',
            documentId: tab.documentId,
            bibleBook: tab.bibleBook,
            bibleChapter: tab.bibleChapter,
            bibleVersionAbbreviation: normalizeBibleAbbreviation(tab.bibleVersionAbbreviation),
        };
    }

    if (tab.type === 'custom') {
        return {
            title: tab.title,
            active: true,
            type: 'custom',
            documentId: tab.documentId,
        };
    }

    return {
        title: tab.title,
        active: true,
        type: 'sermon',
        documentId: tab.documentId,
        languageCode: tab.languageCode,
        translationId: tab.translationId,
    };
}

export const useDocumentTabsStore = create<DocumentTabsState>((set) => ({
    tabs: [],
    pendingNavigation: null,

    setTabs: (tabs) => set({ tabs }),
    setPendingNavigation: (pendingNavigation) => set({ pendingNavigation }),

    addTab: (nextTab) =>
        set((state) => {
            const exists = state.tabs.some((tab) => tabMatches(tab, nextTab));
            if (exists) {
                return {
                    tabs: state.tabs.map((tab) => {
                        const isMatch = tabMatches(tab, nextTab);
                        return {
                            ...tab,
                            active: isMatch,
                            ...(isMatch ? { title: nextTab.title } : {}),
                            ...(isMatch && nextTab.type === 'sermon'
                                ? {
                                      translationId: nextTab.translationId,
                                      languageCode: nextTab.languageCode,
                                  }
                                : {}),
                        };
                    }),
                };
            }

            const deactivated = state.tabs.map((tab) => ({ ...tab, active: false }));
            let nextTabs = [...deactivated, createTab(nextTab)];

            const maxTabs = useAppStore.getState().maxTabs;
            if (nextTabs.length > maxTabs) {
                nextTabs = nextTabs.slice(nextTabs.length - maxTabs);
            }

            return { tabs: nextTabs };
        }),

    removeTab: (key) =>
        set((state) => {
            const idx = state.tabs.findIndex((tab) => matchKey(tab, key));
            const wasActive = idx >= 0 && state.tabs[idx].active;
            const filtered = state.tabs.filter((tab) => !matchKey(tab, key));
            if (wasActive && filtered.length > 0) {
                const nextIdx = Math.min(idx, filtered.length - 1);
                filtered[nextIdx] = { ...filtered[nextIdx], active: true };
            }
            return { tabs: filtered };
        }),

    activateTab: (key) =>
        set((state) => ({
            tabs: state.tabs.map((tab) => ({ ...tab, active: matchKey(tab, key) })),
        })),

    removeOtherTabs: (key) =>
        set((state) => {
            const tab = state.tabs.find((entry) => matchKey(entry, key));
            return tab ? { tabs: [{ ...tab, active: true }] } : {};
        }),

    removeTabsToRight: (key) =>
        set((state) => {
            const idx = state.tabs.findIndex((tab) => matchKey(tab, key));
            if (idx < 0) return {};
            const kept = state.tabs.slice(0, idx + 1);
            if (!kept.some((tab) => tab.active)) {
                kept[kept.length - 1] = { ...kept[kept.length - 1], active: true };
            }
            return { tabs: kept };
        }),

    removeAllTabs: () => set({ tabs: [] }),
    reorderTabs: (tabs) => set({ tabs }),

    updateTabScroll: (key, scrollY, scrollX) =>
        set((state) => ({
            tabs: state.tabs.map((tab) =>
                matchKey(tab, key) ? { ...tab, scrollY, scrollX } : tab,
            ),
        })),

    updateTabZoom: (key, zoom) =>
        set((state) => ({
            tabs: state.tabs.map((tab) => (matchKey(tab, key) ? { ...tab, zoom } : tab)),
        })),

    updateTabTranslationId: (key, translationId) =>
        set((state) => ({
            tabs: state.tabs.map((tab) =>
                matchKey(tab, key) && tab.type === 'sermon' ? { ...tab, translationId } : tab,
            ),
        })),

    updateBibleTab: (key, nextTab) =>
        set((state) => ({
            tabs: state.tabs.map((tab) =>
                matchKey(tab, key) && tab.type === 'bible'
                    ? {
                          ...tab,
                          title: nextTab.title,
                          documentId: nextTab.documentId,
                          bibleBook: nextTab.bibleBook,
                          bibleChapter: nextTab.bibleChapter,
                          bibleVersionAbbreviation: normalizeBibleAbbreviation(
                              nextTab.bibleVersionAbbreviation,
                          ),
                          scrollY: 0,
                      }
                    : tab,
            ),
        })),

    updateBibleTabsVersion: (bibleVersionAbbreviation) =>
        set((state) => ({
            tabs: state.tabs.map((tab) =>
                tab.type === 'bible'
                    ? {
                          ...tab,
                          bibleVersionAbbreviation:
                              normalizeBibleAbbreviation(bibleVersionAbbreviation),
                      }
                    : tab,
            ),
        })),
}));

export function selectTabs(state: DocumentTabsState): DocumentTab[] {
    return state.tabs;
}

export function selectActiveTab(state: DocumentTabsState): DocumentTab | null {
    return state.tabs.find((tab) => tab.active) ?? null;
}

export function selectActiveTabTitle(state: DocumentTabsState): string | null {
    return selectActiveTab(state)?.title ?? null;
}

export function selectActiveTabKey(state: DocumentTabsState): string | null {
    const activeTab = selectActiveTab(state);
    return activeTab ? getTabKey(activeTab) : null;
}

export function selectActiveTabType(state: DocumentTabsState): DocumentTab['type'] | null {
    return selectActiveTab(state)?.type ?? null;
}

export function selectActiveDocumentIdentity(state: DocumentTabsState): DocumentIdentity | null {
    const activeTab = selectActiveTab(state);
    return activeTab ? getDocumentIdentityFromTab(activeTab) : null;
}

export function selectActiveSermonTab(state: DocumentTabsState): SermonTab | null {
    const activeTab = selectActiveTab(state);
    return activeTab?.type === 'sermon' ? activeTab : null;
}

export function selectActiveBibleTab(state: DocumentTabsState): BibleTab | null {
    const activeTab = selectActiveTab(state);
    return activeTab?.type === 'bible' ? activeTab : null;
}

export function selectActiveCustomTab(state: DocumentTabsState): CustomTab | null {
    const activeTab = selectActiveTab(state);
    return activeTab?.type === 'custom' ? activeTab : null;
}

export function selectPendingNavigation(state: DocumentTabsState): PendingNavigation {
    return state.pendingNavigation;
}
