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

export default function SyncListener() {
    const { t } = useTranslation();
    const setSubjects = useSubjectsStore((s) => s.setSubjects);
    const setCustomDocuments = useCustomDocumentsStore((s) => s.setCustomDocuments);
    const setNotes = useNotesStore((s) => s.setNotes);
    const setSyncing = useAppStore((s) => s.setSyncing);
    const aiInitialized = useAiChatStore((s) => s.initialized);
    const loadConversations = useAiChatStore((s) => s.loadConversations);

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
                if (aiInitialized) {
                    loadConversations();
                }
                window.dispatchEvent(new Event(AI_DATA_EVENT.conversationsChanged));
            }
            window.dispatchEvent(new Event(SYNC_EVENT.syncCompleted));
        });

        const cleanupFailure = window.api.on.syncFailure((event) => {
            setSyncing(false);
            window.dispatchEvent(new Event(SYNC_EVENT.syncFailed));

            if (event.disconnected) {
                message.error(
                    t(
                        'Session Google expirée. Le compte a été déconnecté. Reconnectez-vous dans les paramètres de sauvegarde.',
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
    }, [
        aiInitialized,
        loadConversations,
        setSubjects,
        setCustomDocuments,
        setNotes,
        setSyncing,
        t,
    ]);

    return null;
}
