import { useEffect, useMemo, useRef } from 'react';
import { debounce } from '@renderer/utils/functions';
import { useCallbackUpdater } from './index';

export interface DebouncedCommit<T> {
    schedule(value: T): void;
    flush(): void;
    cancel(): void;
    isPending(): boolean;
}

/**
 * Debounces `commit` while always calling its latest version, so a parent that re-renders with a
 * new inline callback does not reset the timer. A pending value is committed on unmount and when
 * the page unloads (reload or quit), so the last keystrokes are never lost.
 */
export function useDebouncedCommit<T>(
    commit: (value: T) => void,
    delay: number,
): DebouncedCommit<T> {
    const latestCommit = useCallbackUpdater(commit);
    const pendingRef = useRef(false);

    const debounced = useMemo(
        () =>
            debounce((value: T) => {
                pendingRef.current = false;
                latestCommit(value);
            }, delay),
        [latestCommit, delay],
    );

    useEffect(() => () => debounced.flush(), [debounced]);

    useEffect(() => {
        const flushBeforeUnload = () => debounced.flush();
        window.addEventListener('beforeunload', flushBeforeUnload);
        window.addEventListener('pagehide', flushBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', flushBeforeUnload);
            window.removeEventListener('pagehide', flushBeforeUnload);
        };
    }, [debounced]);

    return useMemo(
        () => ({
            schedule(value: T) {
                pendingRef.current = true;
                debounced(value);
            },
            flush() {
                debounced.flush();
            },
            cancel() {
                pendingRef.current = false;
                debounced.cancel();
            },
            isPending: () => pendingRef.current,
        }),
        [debounced],
    );
}
