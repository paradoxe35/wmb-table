import type { BibleVersionInfo } from '@shared/types';
import {
    clearDownloadProgress,
    startDownloadProgress,
    updateDownloadProgress,
} from '@renderer/lib/download-feedback';
import { createStore } from './create-store';

interface BibleState {
    versions: BibleVersionInfo[];
    downloadProgress: Record<string, number>;
    setVersions(versions: BibleVersionInfo[]): void;
    startDownload(abbreviation: string): void;
    updateDownload(abbreviation: string, percentage: number): void;
    clearDownload(abbreviation: string): void;
}

export const useBibleStore = createStore<BibleState>((set) => ({
    versions: [],
    downloadProgress: {},
    setVersions: (versions) => set({ versions }),
    startDownload: (abbreviation) =>
        set((state) => ({
            downloadProgress: startDownloadProgress(state.downloadProgress, abbreviation),
        })),
    updateDownload: (abbreviation, percentage) =>
        set((state) => ({
            downloadProgress: updateDownloadProgress(
                state.downloadProgress,
                abbreviation,
                percentage,
            ),
        })),
    clearDownload: (abbreviation) =>
        set((state) => ({
            downloadProgress: clearDownloadProgress(state.downloadProgress, abbreviation),
        })),
}));
