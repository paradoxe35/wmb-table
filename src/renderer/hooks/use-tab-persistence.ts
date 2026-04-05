import { useEffect, useRef } from 'react';
import type { DocumentTab } from '@shared/types';

export function useTabPersistence(
    tabs: DocumentTab[],
    languageCode: string | null,
    hydrated: boolean,
) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevRef = useRef<DocumentTab[]>(tabs);

    useEffect(() => {
        if (!hydrated) return;
        if (tabs === prevRef.current) return;
        prevRef.current = tabs;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            if (languageCode) {
                window.api.documents.saveTabs(languageCode, tabs);
            }
        }, 500);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [tabs, languageCode, hydrated]);
}
