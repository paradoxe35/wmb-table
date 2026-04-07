import type { InstalledLanguage } from '@shared/types';
import { createStore } from './create-store';

interface InstalledLanguagesState {
    installedLanguages: InstalledLanguage[];
    hydrated: boolean;
    refresh(): Promise<void>;
}

export const useInstalledLanguagesStore = createStore<InstalledLanguagesState>((set) => ({
    installedLanguages: [],
    hydrated: false,
    refresh: async () => {
        const langs = await window.api.languages.getInstalled();
        set({ installedLanguages: langs, hydrated: true });
    },
}));

export function selectHasLanguageUpdates(state: InstalledLanguagesState): boolean {
    return state.installedLanguages.some((l) => l.updateAvailable);
}
