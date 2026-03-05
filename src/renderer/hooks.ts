// Legacy hooks file — re-exports from new hooks module for backwards compatibility
// during migration. Can be deleted after D.4 cleanup.

export {
    useContainerHeight as useContainerScrollY,
    useContainerHeight,
    useOpenDocument,
    useOpenCustomDocument,
    useModalVisible,
    useSermonLookup as useDocumentTitle,
    useSermonLookup,
    useActiveTabTitle,
    useTabPersistence,
    useValueStateRef,
    useIpcRequestWithLoader,
} from './hooks/index';
export { useAppStore } from './stores';

import { useCallback, useRef } from 'react';
import { useAppStore } from './stores';

export function useOptionsMenu() {
    const showOptions = useAppStore((s) => s.showOptions);
    return useCallback(
        (option: string) => {
            showOptions(option as 'search');
        },
        [showOptions],
    );
}

export function useDataStateRef<T>(datas: T) {
    const ref = useRef<T>(undefined);
    ref.current = datas;
    return ref;
}

export const useCallbackUpdater = <T extends (...args: any[]) => any>(callback?: T) => {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    return useCallback((...args: Parameters<T>): ReturnType<T> => {
        return callbackRef.current!(...args);
    }, []) as T;
};
