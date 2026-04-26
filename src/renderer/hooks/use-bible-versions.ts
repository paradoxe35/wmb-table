import { useCallback, useMemo } from 'react';
import type { BibleVersionInfo } from '@shared/types';
import { useAppStore } from '@renderer/stores';
import { useBibleStore } from '@renderer/stores/bible.store';

export interface BibleVersionState {
    versions: BibleVersionInfo[];
    activeVersion: string | undefined;
    installed: BibleVersionInfo[];
    downloadable: BibleVersionInfo[];
    downloadProgress: Record<string, number>;
    handleSwitch: (abbreviation: string) => Promise<void>;
    handleDownload: (abbreviation: string) => void;
}

export function useBibleVersions(): BibleVersionState {
    const activeBibleVersion = useAppStore((s) => s.activeBibleVersion);
    const setActiveBibleVersion = useAppStore((s) => s.setActiveBibleVersion);
    const activeVersion = activeBibleVersion?.abbreviation;
    const versions = useBibleStore((s) => s.versions);
    const downloadProgress = useBibleStore((s) => s.downloadProgress);
    const startDownload = useBibleStore((s) => s.startDownload);
    const setVersions = useBibleStore((s) => s.setVersions);

    const handleSwitch = useCallback(
        async (abbreviation: string) => {
            await window.api.bible.switchVersion(abbreviation);
            const v = await window.api.bible.getActiveVersion();
            setActiveBibleVersion(v);
            setVersions(await window.api.bible.getVersions());
        },
        [setActiveBibleVersion, setVersions],
    );

    const handleDownload = useCallback(
        (abbreviation: string) => {
            startDownload(abbreviation);
            void window.api.bible.downloadVersion(abbreviation).catch(() => {});
        },
        [startDownload],
    );

    const { installed, downloadable } = useMemo(() => {
        const inst: BibleVersionInfo[] = [];
        const dl: BibleVersionInfo[] = [];
        for (const v of versions) {
            if (v.available) {
                inst.push(v);
            } else {
                dl.push(v);
            }
        }
        return { installed: inst, downloadable: dl };
    }, [versions]);

    return {
        versions,
        activeVersion,
        installed,
        downloadable,
        downloadProgress,
        handleSwitch,
        handleDownload,
    };
}
