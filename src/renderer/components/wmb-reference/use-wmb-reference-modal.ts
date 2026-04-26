import { useCallback, useRef, useState } from 'react';
import { parseWmbLink } from '@shared/wmb-link';

import {
    resolveBibleReference,
    resolveDocReference,
    resolveSermonReference,
    type WmbReferenceData,
} from './resolvers';

export type UseWmbReferenceModalResult = {
    open: boolean;
    loading: boolean;
    data: WmbReferenceData | null;
    href: string | null;
    /** Open the modal for a wmb:// link. Returns true if the link was a valid wmb reference. */
    showWmbReference: (href: string) => boolean;
    onClose: () => void;
};

/**
 * State + async resolution for the wmb:// reference modal. Mount the corresponding
 * <WmbReferenceModal {...result} /> once in your tree, then call `showWmbReference(href)`
 * from any click handler to open it.
 */
export function useWmbReferenceModal(): UseWmbReferenceModalResult {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<WmbReferenceData | null>(null);
    const [href, setHref] = useState<string | null>(null);

    // Tracks the latest in-flight request so a stale resolution can't overwrite a newer one.
    const requestIdRef = useRef(0);

    const showWmbReference = useCallback((nextHref: string): boolean => {
        const ref = parseWmbLink(nextHref);
        if (!ref) return false;

        const requestId = ++requestIdRef.current;
        setHref(nextHref);
        setData(null);
        setLoading(true);
        setOpen(true);

        const promise =
            ref.type === 'sermon'
                ? resolveSermonReference(ref)
                : ref.type === 'bible'
                  ? resolveBibleReference(ref)
                  : resolveDocReference(ref);

        promise.then((resolved) => {
            if (requestIdRef.current !== requestId) return;
            setData(resolved);
            setLoading(false);
        });

        return true;
    }, []);

    const onClose = useCallback(() => {
        setOpen(false);
    }, []);

    return { open, loading, data, href, showWmbReference, onClose };
}
