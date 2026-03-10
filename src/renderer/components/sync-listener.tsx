import { useEffect } from 'react';
import { message } from 'antd';
import { useSubjectsStore, useCustomDocumentsStore } from '@renderer/stores';
import { HIGHLIGHT_EVENT, SYNC_EVENT } from '@renderer/utils/events';

const AUTH_FAILURE_THRESHOLD = 4;

export default function SyncListener() {
    const setSubjects = useSubjectsStore((s) => s.setSubjects);
    const setCustomDocuments = useCustomDocumentsStore((s) => s.setCustomDocuments);

    useEffect(() => {
        const cleanupSuccess = window.api.on.newSynchronizedDatas((tables) => {
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

        const cleanupFailure = window.api.on.syncFailure((event) => {
            window.dispatchEvent(new Event(SYNC_EVENT.syncFailed));

            if (event.isAuthError && event.consecutiveFailures >= AUTH_FAILURE_THRESHOLD) {
                message.warning(
                    'Session Google expirée. Veuillez vous reconnecter dans les paramètres de sauvegarde.',
                    10,
                );
            }
        });

        // Trigger immediate sync when browser comes back online
        const onOnline = () => window.api.sync.syncNow();
        window.addEventListener('online', onOnline);

        return () => {
            cleanupSuccess();
            cleanupFailure();
            window.removeEventListener('online', onOnline);
        };
    }, [setSubjects, setCustomDocuments]);

    return null;
}
