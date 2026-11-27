import { useCallback, useEffect, useState } from 'react';
import type { McpServerSettingsPatch, McpServerStatus } from '@shared/mcp.types';

export interface McpServerState {
    status: McpServerStatus | null;
    pending: boolean;
    /** The settings could not reach the main process at all. */
    saveFailed: boolean;
    update(patch: McpServerSettingsPatch): void;
}

export function useMcpServer(): McpServerState {
    const [status, setStatus] = useState<McpServerStatus | null>(null);
    const [pending, setPending] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);

    useEffect(() => {
        let active = true;
        void window.api.mcp.getStatus().then((next) => {
            if (active) setStatus(next);
        });
        return () => {
            active = false;
        };
    }, []);

    const update = useCallback((patch: McpServerSettingsPatch) => {
        setPending(true);
        setStatus((current) =>
            current ? { ...current, settings: { ...current.settings, ...patch } } : current,
        );
        window.api.mcp
            .updateSettings(patch)
            .then((next) => {
                setStatus(next);
                setSaveFailed(false);
            })
            .catch(async () => {
                setSaveFailed(true);
                setStatus(await window.api.mcp.getStatus());
            })
            .finally(() => setPending(false));
    }, []);

    return { status, pending, saveFailed, update };
}
