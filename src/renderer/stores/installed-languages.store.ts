import type { InstalledLanguage } from '@shared/types';
import { createStore } from './create-store';

export interface RefreshInstalledLanguagesOptions {
    checkForUpdates?: boolean;
    force?: boolean;
    includeStats?: boolean;
}

interface InstalledLanguagesState {
    installedLanguages: InstalledLanguage[];
    hydrated: boolean;
    refresh(options?: RefreshInstalledLanguagesOptions): Promise<void>;
}

export const useInstalledLanguagesStore = createStore<InstalledLanguagesState>((set) => ({
    installedLanguages: [],
    hydrated: false,
    refresh: async (options) => {
        const langs = await window.api.languages.getInstalled(options);
        set({ installedLanguages: langs, hydrated: true });
    },
}));

export function selectHasLanguageUpdates(state: InstalledLanguagesState): boolean {
    return state.installedLanguages.some((l) => l.updateAvailable);
}
