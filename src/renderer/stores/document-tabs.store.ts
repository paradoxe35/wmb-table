import type {
    BibleTab,
    CustomTab,
    DocumentReference,
    DocumentIdentity,
    DocumentTab,
    SermonTab,
} from '@shared/types';
import { createStore } from './create-store';
import {
    getDocumentIdentityFromTab,
    getDocumentIdentityKey,
    getTabKey,
    normalizeBibleAbbreviation,
    tabMatches,
} from '@shared/types';
import { useTtsStore } from './tts.store';
import { useAudioStore } from './audio.store';

export type PendingNavigation = {
    target: DocumentIdentity;
    documentReference: DocumentReference;
} | null;

interface DocumentTabsState {
    tabs: DocumentTab[];
    hydrated: boolean;
    pendingNavigation: PendingNavigation;

    setTabs(tabs: DocumentTab[]): void;
    setHydrated(hydrated: boolean): void;
    setPendingNavigation(nav: PendingNavigation): void;
    addTab(tab: NewDocumentTab, maxTabs: number): void;
    removeTab(key: string): void;
    activateTab(key: string): void;
    removeOtherTabs(key: string): void;
    removeTabsToRight(key: string): void;
    removeAllTabs(): void;
    reorderTabs(tabs: DocumentTab[]): void;
    enforceTabLimit(maxTabs: number): void;
    updateTabScroll(key: string, scrollY?: number, scrollX?: number): void;
    updateTabTitle(key: string, title: string): void;
    updateSermonTab(key: string, tab: SermonTabUpdate): void;
    updateBibleTab(key: string, tab: BibleTabUpdate): void;
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
export type NewDocumentTab = NewSermonTab | NewBibleTab | NewCustomTab;

type BibleTabUpdate = Pick<
    BibleTab,
    'title' | 'documentId' | 'bibleBook' | 'bibleChapter' | 'bibleVersionAbbreviation'
>;
type SermonTabUpdate = Pick<SermonTab, 'title' | 'documentId' | 'translationId' | 'languageCode'>;

function isMatchingSermonSource(tab: DocumentTab, nextTab: SermonTabUpdate): tab is SermonTab {
    return (
        tab.type === 'sermon' &&
        tab.documentId === nextTab.documentId &&
        tab.translationId === nextTab.translationId &&
        tab.languageCode === nextTab.languageCode
    );
}

function isMatchingBibleSource(tab: DocumentTab, nextTab: BibleTabUpdate): tab is BibleTab {
    return (
        tab.type === 'bible' &&
        tab.documentId === nextTab.documentId &&
        normalizeBibleAbbreviation(tab.bibleVersionAbbreviation) ===
            normalizeBibleAbbreviation(nextTab.bibleVersionAbbreviation)
    );
}

function activateMatchingTab<T extends DocumentTab>(
    tabs: DocumentTab[],
    matcher: (tab: DocumentTab) => tab is T,
): DocumentTab[] {
    return tabs.map((tab) => ({ ...tab, active: matcher(tab) }));
}

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

function findAutoProtectedTabKey(tabs: DocumentTab[]): string | null {
    const ttsState = useTtsStore.getState();
    const audioState = useAudioStore.getState();

    const ttsDocumentKey =
        ttsState.status === 'playing' || ttsState.status === 'loading'
            ? ttsState.documentKey
            : null;

    if (ttsDocumentKey) {
        const ttsTab = tabs.find(
            (tab) => getDocumentIdentityKey(getDocumentIdentityFromTab(tab)) === ttsDocumentKey,
        );
        if (ttsTab) {
            return getTabKey(ttsTab);
        }
    }

    if (audioState.currentPlay?.status !== 'play') {
        return null;
    }

    const audioTab = tabs.find(
        (tab) =>
            tab.type === 'sermon' &&
            audioState.sermonId === tab.documentId &&
            audioState.translationId === tab.translationId &&
            audioState.languageCode === tab.languageCode,
    );

    return audioTab ? getTabKey(audioTab) : null;
}

function isAutoProtectedTab(tab: DocumentTab, protectedKey: string | null): boolean {
    if (!protectedKey) {
        return false;
    }

    return getTabKey(tab) === protectedKey;
}

export function clampTabsToLimit(tabs: DocumentTab[], maxTabs: number): DocumentTab[] {
    if (tabs.length <= maxTabs) {
        return tabs;
    }

    const protectedKey = findAutoProtectedTabKey(tabs);
    const keptTabs = [...tabs];
    let overflow = keptTabs.length - maxTabs;

    for (let index = 0; index < keptTabs.length && overflow > 0; index++) {
        if (isAutoProtectedTab(keptTabs[index], protectedKey)) {
            continue;
        }

        keptTabs.splice(index, 1);
        index--;
        overflow--;
    }

    if (keptTabs.some((tab) => tab.active)) {
        return keptTabs;
    }

    if (keptTabs.length === 0) {
        return keptTabs;
    }

    keptTabs[keptTabs.length - 1] = {
        ...keptTabs[keptTabs.length - 1],
        active: true,
    };
    return keptTabs;
}

export const useDocumentTabsStore = createStore<DocumentTabsState>((set) => ({
    tabs: [],
    hydrated: false,
    pendingNavigation: null,

    setTabs: (tabs) => set({ tabs, hydrated: true }),
    setHydrated: (hydrated) => set({ hydrated }),
    setPendingNavigation: (pendingNavigation) => set({ pendingNavigation }),

    addTab: (nextTab, maxTabs) =>
        set((state) => {
            const exists = state.tabs.some((tab) => tabMatches(tab, nextTab));
            if (exists) {
                return {
                    hydrated: true,
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
            return {
                hydrated: true,
                tabs: clampTabsToLimit([...deactivated, createTab(nextTab)], maxTabs),
            };
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
            return { hydrated: true, tabs: filtered };
        }),

    activateTab: (key) =>
        set((state) => ({
            hydrated: true,
            tabs: state.tabs.map((tab) => ({ ...tab, active: matchKey(tab, key) })),
        })),

    removeOtherTabs: (key) =>
        set((state) => {
            const tab = state.tabs.find((entry) => matchKey(entry, key));
            return tab ? { hydrated: true, tabs: [{ ...tab, active: true }] } : {};
        }),

    removeTabsToRight: (key) =>
        set((state) => {
            const idx = state.tabs.findIndex((tab) => matchKey(tab, key));
            if (idx < 0) return {};
            const kept = state.tabs.slice(0, idx + 1);
            if (!kept.some((tab) => tab.active)) {
                kept[kept.length - 1] = { ...kept[kept.length - 1], active: true };
            }
            return { hydrated: true, tabs: kept };
        }),

    removeAllTabs: () => set({ tabs: [], hydrated: true }),
    reorderTabs: (tabs) => set({ tabs, hydrated: true }),
    enforceTabLimit: (maxTabs) =>
        set((state) => ({
            hydrated: true,
            tabs: clampTabsToLimit(state.tabs, maxTabs),
        })),

    updateTabScroll: (key, scrollY, scrollX) =>
        set((state) => ({
            hydrated: true,
            tabs: state.tabs.map((tab) =>
                matchKey(tab, key) ? { ...tab, scrollY, scrollX } : tab,
            ),
        })),

    updateTabTitle: (key, title) =>
        set((state) => ({
            hydrated: true,
            tabs: state.tabs.map((tab) =>
                matchKey(tab, key) && tab.title !== title ? { ...tab, title } : tab,
            ),
        })),

    updateSermonTab: (key, nextTab) =>
        set((state) => {
            const currentTab = state.tabs.find(
                (tab): tab is SermonTab => matchKey(tab, key) && tab.type === 'sermon',
            );
            if (!currentTab) {
                return {};
            }

            const existingTarget = state.tabs.find(
                (tab) => !matchKey(tab, key) && isMatchingSermonSource(tab, nextTab),
            );

            if (existingTarget) {
                return {
                    hydrated: true,
                    tabs: activateMatchingTab(
                        state.tabs.filter((tab) => !matchKey(tab, key)),
                        (tab): tab is SermonTab => isMatchingSermonSource(tab, nextTab),
                    ),
                };
            }

            return {
                hydrated: true,
                tabs: state.tabs.map((tab) => {
                    if (matchKey(tab, key) && tab.type === 'sermon') {
                        return {
                            ...tab,
                            title: nextTab.title,
                            documentId: nextTab.documentId,
                            translationId: nextTab.translationId,
                            languageCode: nextTab.languageCode,
                            // Clear rather than zero: the previous translation's
                            // scroll must not carry over, and leaving it unset lets
                            // the target translation's own saved position restore.
                            scrollY: undefined,
                            scrollX: undefined,
                        };
                    }

                    return tab;
                }),
            };
        }),

    updateBibleTab: (key, nextTab) =>
        set((state) => {
            const currentTab = state.tabs.find(
                (tab): tab is BibleTab => matchKey(tab, key) && tab.type === 'bible',
            );
            if (!currentTab) {
                return {};
            }

            const existingTarget = state.tabs.find(
                (tab) => !matchKey(tab, key) && isMatchingBibleSource(tab, nextTab),
            );

            if (existingTarget) {
                return {
                    hydrated: true,
                    tabs: activateMatchingTab(
                        state.tabs.filter((tab) => !matchKey(tab, key)),
                        (tab): tab is BibleTab => isMatchingBibleSource(tab, nextTab),
                    ),
                };
            }

            return {
                hydrated: true,
                tabs: state.tabs.map((tab) => {
                    if (matchKey(tab, key) && tab.type === 'bible') {
                        return {
                            ...tab,
                            title: nextTab.title,
                            documentId: nextTab.documentId,
                            bibleBook: nextTab.bibleBook,
                            bibleChapter: nextTab.bibleChapter,
                            bibleVersionAbbreviation: normalizeBibleAbbreviation(
                                nextTab.bibleVersionAbbreviation,
                            ),
                            scrollY: 0,
                            scrollX: 0,
                        };
                    }
                    return tab;
                }),
            };
        }),
}));

export function selectTabs(state: DocumentTabsState): DocumentTab[] {
    return state.tabs;
}

export function selectTabsHydrated(state: DocumentTabsState): boolean {
    return state.hydrated;
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
