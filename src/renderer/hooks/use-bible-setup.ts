import { useCallback, useEffect, useRef } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import type { BibleDownloadedEvent } from '@shared/types';
import { buildDownloadErrorMessage } from '@renderer/lib/download-feedback';
import { useAppStore } from '@renderer/stores';
import { useBibleStore } from '@renderer/stores/bible.store';

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

function showDownloadFailedMessage(
    t: (key: string, options?: Record<string, string>) => string,
    abbreviation: string,
    error: unknown,
): void {
    message.open({
        type: 'error',
        key: `bible-download-failed:${abbreviation}`,
        content: buildDownloadErrorMessage(t, error, 'Le téléchargement a échoué.'),
    });
}

/**
 * Top-level Bible hook: version refresh and download IPC listeners.
 * Called once in App — not from each Bible selector.
 */
export function useBibleSetup(): void {
    const { t } = useTranslation();
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const setActiveBibleVersion = useAppStore((s) => s.setActiveBibleVersion);
    const setVersions = useBibleStore((s) => s.setVersions);
    const updateDownload = useBibleStore((s) => s.updateDownload);
    const clearDownload = useBibleStore((s) => s.clearDownload);
    const requestIdRef = useRef(0);
    const contentLanguageRef = useRef<string | null>(contentLanguage);
    contentLanguageRef.current = contentLanguage;

    const refresh = useCallback(
        async (expectedLanguage: string | null): Promise<void> => {
            const requestId = ++requestIdRef.current;
            if (!expectedLanguage) {
                if (
                    requestId === requestIdRef.current &&
                    contentLanguageRef.current === expectedLanguage
                ) {
                    setVersions([]);
                }
                return;
            }

            const nextVersions = await window.api.bible.getVersions();
            if (
                requestId !== requestIdRef.current ||
                contentLanguageRef.current !== expectedLanguage
            ) {
                return;
            }
            setVersions(nextVersions);
        },
        [setVersions],
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
    }, [contentLanguage, refresh, setVersions]);

    useEffect(() => {
        const unsubscribeProgress = window.api.on.bibleDownloadProgress((progress) => {
            updateDownload(progress.abbreviation, progress.percentage);
        });
        const unsubscribeDownloaded = window.api.on.bibleDownloaded(
            async ({ abbreviation }: BibleDownloadedEvent) => {
                clearDownload(abbreviation);
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
        const unsubscribeFailed = window.api.on.bibleDownloadFailed(({ abbreviation, error }) => {
            clearDownload(abbreviation);
            showDownloadFailedMessage(t, abbreviation, error);
        });

        return () => {
            unsubscribeProgress();
            unsubscribeDownloaded();
            unsubscribeFailed();
        };
    }, [clearDownload, refresh, setActiveBibleVersion, t, updateDownload]);
}
