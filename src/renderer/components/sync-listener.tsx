import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';
import {
    useAppStore,
    useSubjectsStore,
    useCustomDocumentsStore,
    useNotesStore,
    useAiChatStore,
} from '@renderer/stores';
import { AI_DATA_EVENT, HIGHLIGHT_EVENT, SYNC_EVENT } from '@renderer/utils/events';

const AUTH_FAILURE_THRESHOLD = 4;

export default function SyncListener() {
    const { t } = useTranslation();
    const setSubjects = useSubjectsStore((s) => s.setSubjects);
    const setCustomDocuments = useCustomDocumentsStore((s) => s.setCustomDocuments);
    const setNotes = useNotesStore((s) => s.setNotes);
    const setSyncing = useAppStore((s) => s.setSyncing);

    useEffect(() => {
        const cleanupSuccess = window.api.on.newSynchronizedDatas((tables) => {
            setSyncing(false);
            if (tables.includes('highlights')) {
                window.dispatchEvent(new Event(HIGHLIGHT_EVENT.highlightsUpdated));
            }
            if (tables.includes('subjects') || tables.includes('subject_items')) {
                window.api.subjects.getAll().then(setSubjects);
                window.dispatchEvent(new Event(AI_DATA_EVENT.subjectsChanged));
            }
            if (tables.includes('custom_documents')) {
                window.api.app.getCustomDocuments().then(setCustomDocuments);
            }
            if (
                tables.includes('notes') ||
                tables.includes('notes_references') ||
                tables.includes('notes_bible_references')
            ) {
                window.api.notes.getAll().then(setNotes);
                window.dispatchEvent(new Event(AI_DATA_EVENT.notesChanged));
            }
            if (tables.includes('ai_conversations') || tables.includes('ai_messages')) {
                const aiStore = useAiChatStore.getState();
                if (aiStore.initialized) {
                    aiStore.loadConversations();
                }
                window.dispatchEvent(new Event(AI_DATA_EVENT.conversationsChanged));
            }
            window.dispatchEvent(new Event(SYNC_EVENT.syncCompleted));
        });

        const cleanupFailure = window.api.on.syncFailure((event) => {
            setSyncing(false);
            window.dispatchEvent(new Event(SYNC_EVENT.syncFailed));

            if (event.isAuthError && event.consecutiveFailures >= AUTH_FAILURE_THRESHOLD) {
                message.warning(
                    t(
                        'Session Google expirée. Veuillez vous reconnecter dans les paramètres de sauvegarde.',
                    ),
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
    }, [setSubjects, setCustomDocuments, setNotes, setSyncing]);

    return null;
}
