import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BibleDownloadProgress, BibleDownloadedEvent, BibleVersionInfo } from '@shared/types';
import { useAppStore, useDocumentTabsStore } from '@renderer/stores';

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
    const setActiveBibleVersion = useAppStore((s) => s.setActiveBibleVersion);
    const activeVersion = activeBibleVersion?.abbreviation;
    const updateBibleTabsVersion = useDocumentTabsStore((s) => s.updateBibleTabsVersion);
    const [versions, setVersions] = useState<BibleVersionInfo[]>(cachedVersions);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

    const refresh = useCallback(async () => {
        const nextVersions = await window.api.bible.getVersions();
        cachedVersions = nextVersions;
        cachedForLanguage = contentLanguage;
        setVersions(nextVersions);
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
            setActiveBibleVersion(v);
            if (v?.abbreviation) {
                updateBibleTabsVersion(v.abbreviation);
            }
            refresh();
        },
        [refresh, setActiveBibleVersion, updateBibleTabsVersion],
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
