import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import type { BibleDownloadProgress, BibleDownloadedEvent, BibleVersionInfo } from '@shared/types';
import {
    buildDownloadErrorMessage,
    clearDownloadProgress,
    startDownloadProgress,
    updateDownloadProgress,
} from '@renderer/lib/download-feedback';
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

let remoteRefreshPromise: Promise<void> | null = null;

function refreshRemoteBibleIndex(): Promise<void> {
    if (!remoteRefreshPromise) {
        remoteRefreshPromise = window.api.bible
            .refreshIndex()
            .then(() => undefined)
            .catch(() => undefined)
            .finally(() => {
                remoteRefreshPromise = null;
            });
    }

    return remoteRefreshPromise;
}

export function useBibleVersions(): BibleVersionState {
    const { t } = useTranslation();
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const activeBibleVersion = useAppStore((s) => s.activeBibleVersion);
    const setActiveBibleVersion = useAppStore((s) => s.setActiveBibleVersion);
    const activeVersion = activeBibleVersion?.abbreviation;
    const [versions, setVersions] = useState<BibleVersionInfo[]>([]);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
    const requestIdRef = useRef(0);
    const contentLanguageRef = useRef<string | null>(contentLanguage);
    contentLanguageRef.current = contentLanguage;

    const refresh = useCallback(
        async (expectedLanguage: string | null): Promise<BibleVersionInfo[] | null> => {
            const requestId = ++requestIdRef.current;
            if (!expectedLanguage) {
                if (
                    requestId === requestIdRef.current &&
                    contentLanguageRef.current === expectedLanguage
                ) {
                    setVersions([]);
                }
                return [];
            }

            const nextVersions = await window.api.bible.getVersions();
            if (
                requestId !== requestIdRef.current ||
                contentLanguageRef.current !== expectedLanguage
            ) {
                return null;
            }
            setVersions(nextVersions);
            return nextVersions;
        },
        [],
    );

    useEffect(() => {
        const expectedLanguage = contentLanguage;
        if (!expectedLanguage) {
            setVersions([]);
            return;
        }

        void refresh(expectedLanguage);
        void refreshRemoteBibleIndex().then(() => {
            void refresh(expectedLanguage);
        });
    }, [refresh, contentLanguage]);

    const handleSwitch = useCallback(
        async (abbreviation: string) => {
            await window.api.bible.switchVersion(abbreviation);
            const v = await window.api.bible.getActiveVersion();
            setActiveBibleVersion(v);
            void refresh(contentLanguageRef.current);
        },
        [refresh, setActiveBibleVersion],
    );

    const handleDownload = useCallback((abbreviation: string) => {
        setDownloadProgress((prev) => startDownloadProgress(prev, abbreviation));
        void window.api.bible.downloadVersion(abbreviation).catch(() => {});
    }, []);

    useEffect(() => {
        const unsub1 = window.api.on.bibleDownloadProgress((p: BibleDownloadProgress) => {
            setDownloadProgress((prev) =>
                updateDownloadProgress(prev, p.abbreviation, p.percentage),
            );
        });
        const unsub2 = window.api.on.bibleDownloaded(
            async ({ abbreviation }: BibleDownloadedEvent) => {
                setDownloadProgress((prev) => clearDownloadProgress(prev, abbreviation));
                const expectedLanguage = contentLanguageRef.current;
                const [nextActiveVersion] = await Promise.all([
                    window.api.bible.getActiveVersion(),
                    refresh(expectedLanguage),
                ]);
                if (contentLanguageRef.current === expectedLanguage) {
                    setActiveBibleVersion(nextActiveVersion);
                }
            },
        );
        const unsub3 = window.api.on.bibleDownloadFailed(({ abbreviation, error }) => {
            setDownloadProgress((prev) => clearDownloadProgress(prev, abbreviation));
            message.error(buildDownloadErrorMessage(t, error, 'Le téléchargement a échoué.'));
        });
        return () => {
            unsub1();
            unsub2();
            unsub3();
        };
    }, [refresh, setActiveBibleVersion, t]);

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
