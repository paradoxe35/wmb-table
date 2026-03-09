import { useEffect } from 'react';
import { useSubjectsStore, useCustomDocumentsStore } from '@renderer/stores';
import { HIGHLIGHT_EVENT, SYNC_EVENT } from '@renderer/utils/events';

export default function SyncListener() {
    const setSubjects = useSubjectsStore((s) => s.setSubjects);
    const setCustomDocuments = useCustomDocumentsStore((s) => s.setCustomDocuments);

    useEffect(() => {
        const cleanup = window.api.on.newSynchronizedDatas((tables) => {
            if (tables.includes('highlights')) {
                window.dispatchEvent(new Event(HIGHLIGHT_EVENT.highlightsUpdated));
            }
            if (tables.includes('subjects') || tables.includes('subject_items')) {
                window.api.subjects.getAll().then(setSubjects);
            }
            if (tables.includes('custom_documents')) {
                window.api.app.getCustomDocuments().then(setCustomDocuments);
            }
            window.dispatchEvent(new Event(SYNC_EVENT.syncCompleted));
        });
        return cleanup;
    }, [setSubjects, setCustomDocuments]);

    return null;
}
