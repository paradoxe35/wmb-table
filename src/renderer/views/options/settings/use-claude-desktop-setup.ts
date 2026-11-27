import { useCallback, useEffect, useState } from 'react';
import type { McpClientStatus } from '@shared/mcp.types';

export interface ClaudeDesktopSetupState {
    status: McpClientStatus | null;
    pending: boolean;
    /** Set once this window wrote the configuration, to show the restart hint. */
    justConfigured: boolean;
    configure(): void;
}

function findClaudeDesktop(statuses: McpClientStatus[]): McpClientStatus | null {
    return statuses.find((status) => status.clientId === 'claude-desktop') ?? null;
}

/** Checks again whenever the window gets focus, so an install made meanwhile shows up. */
export function useClaudeDesktopSetup(): ClaudeDesktopSetupState {
    const [status, setStatus] = useState<McpClientStatus | null>(null);
    const [pending, setPending] = useState(false);
    const [justConfigured, setJustConfigured] = useState(false);

    useEffect(() => {
        let active = true;
        const detect = () => {
            void window.api.mcp.detectClients().then((statuses) => {
                if (active) setStatus(findClaudeDesktop(statuses));
            });
        };
        detect();
        window.addEventListener('focus', detect);
        return () => {
            active = false;
            window.removeEventListener('focus', detect);
        };
    }, []);

    const configure = useCallback(() => {
        setPending(true);
        window.api.mcp
            .configureClient({ clientId: 'claude-desktop' })
            .then((next) => {
                setStatus(next);
                setJustConfigured(next.state === 'configured');
            })
            .catch(() => {
                setStatus((current) =>
                    current ? { ...current, state: 'error', error: 'write-failed' } : current,
                );
            })
            .finally(() => setPending(false));
    }, []);

    return { status, pending, justConfigured, configure };
}
