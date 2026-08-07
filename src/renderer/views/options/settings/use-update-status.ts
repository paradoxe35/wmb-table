import { useCallback, useEffect, useRef, useState } from 'react';
import type { UpdaterNotification } from '@shared/types';
import { useAppStore } from '@renderer/stores';
import { buildDownloadPageLink } from '@shared/constants';

type UserAction = 'check' | 'download';

export interface UpdateStatus {
    info: UpdaterNotification | undefined;
    /** True while a check is in flight, from either side of the IPC boundary */
    checking: boolean;
    isDownloading: boolean;
    busy: boolean;
    /** What the user last asked for, so a retry repeats that rather than guessing */
    lastAction: UserAction;
    check: () => void;
    download: () => void;
    cancel: () => void;
    install: () => void;
    openDownloadPage: () => void;
    retry: () => void;
}

export function useUpdateStatus(): UpdateStatus {
    const [info, setInfo] = useState<UpdaterNotification | undefined>(undefined);
    const [pending, setPending] = useState<UserAction | null>(null);
    const lastActionRef = useRef<UserAction>('check');
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const run = useCallback((action: UserAction, call: () => Promise<UpdaterNotification>) => {
        lastActionRef.current = action;
        setPending(action);
        call().then(
            (next) => {
                if (!mountedRef.current) return;
                setInfo(next);
                setPending(null);
            },
            () => setPending(null),
        );
    }, []);

    useEffect(() => {
        window.api.app.getUpdateStatus().then((status) => {
            if (mountedRef.current) setInfo(status);
        });
        return window.api.on.notifyForNewUpdate((data) => {
            if (!mountedRef.current) return;
            setInfo(data);
            // 'checking' is transient; anything else means the action resolved
            if (data.type !== 'checking') setPending(null);
        });
    }, []);

    const check = useCallback(() => run('check', window.api.app.checkForUpdates), [run]);
    const download = useCallback(() => run('download', window.api.app.startDownloadUpdate), [run]);
    const cancel = useCallback(() => run('download', window.api.app.cancelDownloadUpdate), [run]);
    const install = useCallback(() => window.api.app.quitAndInstallUpdate(), []);
    const retry = useCallback(
        () => (lastActionRef.current === 'download' ? download() : check()),
        [check, download],
    );

    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const openDownloadPage = useCallback(() => {
        window.api.app.openExternal(buildDownloadPageLink(contentLanguage));
    }, [contentLanguage]);

    const isDownloading = info?.type === 'downloading' || pending === 'download';

    return {
        info,
        checking: !isDownloading && (pending === 'check' || info?.type === 'checking'),
        isDownloading,
        busy: pending !== null,
        lastAction: lastActionRef.current,
        check,
        download,
        cancel,
        install,
        openDownloadPage,
        retry,
    };
}
