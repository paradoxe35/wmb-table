import { create } from 'zustand';
import type { DownloadableLanguage } from '@shared/types';

interface SetupState {
    availableLanguages: DownloadableLanguage[];
    selectedLanguages: Set<string>;
    downloadingLanguage: string | null;
    downloadProgress: number;
    installedLanguages: string[];

    setAvailableLanguages(langs: DownloadableLanguage[]): void;
    toggleLanguage(code: string): void;
    setDownloading(code: string | null, progress: number): void;
    addInstalled(code: string): void;
}

export const useSetupStore = create<SetupState>((set) => ({
    availableLanguages: [],
    selectedLanguages: new Set<string>(),
    downloadingLanguage: null,
    downloadProgress: 0,
    installedLanguages: [],

    setAvailableLanguages: (langs) => set({ availableLanguages: langs }),

    toggleLanguage: (code) =>
        set((s) => {
            const next = new Set(s.selectedLanguages);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return { selectedLanguages: next };
        }),

    setDownloading: (code, progress) =>
        set({ downloadingLanguage: code, downloadProgress: progress }),

    addInstalled: (code) =>
        set((s) => ({
            installedLanguages: [...s.installedLanguages, code],
            downloadingLanguage: null,
            downloadProgress: 0,
            selectedLanguages: (() => {
                const next = new Set(s.selectedLanguages);
                next.delete(code);
                return next;
            })(),
        })),
}));
