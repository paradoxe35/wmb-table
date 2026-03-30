import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BibleDownloadProgress, BibleDownloadedEvent, BibleVersionInfo } from '@shared/types';
import { useAppStore } from '@renderer/stores';

export interface BibleVersionState {
    versions: BibleVersionInfo[];
    activeVersion: string | undefined;
    installed: BibleVersionInfo[];
    downloadable: BibleVersionInfo[];
    downloadProgress: Record<string, number>;
    handleSwitch: (abbreviation: string) => Promise<void>;
    handleDownload: (abbreviation: string) => void;
}

let cachedVersions: BibleVersionInfo[] = [];
let cachedForLanguage: string | null = null;

function invalidateCache() {
    cachedVersions = [];
}

export function useBibleVersions(): BibleVersionState {
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const activeBibleVersion = useAppStore((s) => s.activeBibleVersion);
    const activeVersion = activeBibleVersion?.abbreviation;
    const [versions, setVersions] = useState<BibleVersionInfo[]>(cachedVersions);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

    const refresh = useCallback(async () => {
        const langVersions = await window.api.bible.getVersions();
        const all =
            langVersions.length > 0 ? langVersions : await window.api.bible.getAllVersions();

        cachedVersions = all;
        cachedForLanguage = contentLanguage;

        setVersions(all);
    }, [contentLanguage]);

    useEffect(() => {
        if (contentLanguage !== cachedForLanguage) {
            invalidateCache();
            setVersions([]);
        }
        if (cachedVersions.length > 0) {
            return;
        }
        window.api.bible
            .refreshIndex()
            .then(() => refresh())
            .catch(() => refresh());
    }, [refresh, contentLanguage]);

    const handleSwitch = useCallback(
        async (abbreviation: string) => {
            await window.api.bible.switchVersion(abbreviation);
            const v = await window.api.bible.getActiveVersion();
            useAppStore.getState().setActiveBibleVersion(v);
            refresh();
        },
        [refresh],
    );

    const handleDownload = useCallback((abbreviation: string) => {
        setDownloadProgress((prev) => ({ ...prev, [abbreviation]: 0 }));
        window.api.bible.downloadVersion(abbreviation);
    }, []);

    useEffect(() => {
        const unsub1 = window.api.on.bibleDownloadProgress((p: BibleDownloadProgress) => {
            setDownloadProgress((prev) => ({ ...prev, [p.abbreviation]: p.percentage }));
        });
        const unsub2 = window.api.on.bibleDownloaded(({ abbreviation }: BibleDownloadedEvent) => {
            setDownloadProgress((prev) => {
                const next = { ...prev };
                delete next[abbreviation];
                return next;
            });
            handleSwitch(abbreviation);
        });
        return () => {
            unsub1();
            unsub2();
        };
    }, [handleSwitch]);

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
