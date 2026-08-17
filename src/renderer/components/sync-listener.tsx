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
    const setSyncProgress = useAppStore((s) => s.setSyncProgress);
    const aiInitialized = useAiChatStore((s) => s.initialized);
    const refreshAiAfterSync = useAiChatStore((s) => s.refreshAfterSync);

    useEffect(() => {
        const refreshChangedTables = (tables: string[]) => {
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
                    void refreshAiAfterSync();
                }
                window.dispatchEvent(new Event(AI_DATA_EVENT.conversationsChanged));
            }
        };

        const cleanupProgress = window.api.on.syncProgress(setSyncProgress);

        const cleanupSuccess = window.api.on.newSynchronizedDatas((tables) => {
            setSyncing(false);
            setSyncProgress(null);
            refreshChangedTables(tables);
            window.dispatchEvent(new Event(SYNC_EVENT.syncCompleted));
        });

        const cleanupFailure = window.api.on.syncFailure((event) => {
            setSyncing(false);
            setSyncProgress(null);
            if (event.affectedTables?.length) {
                refreshChangedTables(event.affectedTables);
            }
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

        let lastWakeSyncAt = 0;
        const syncAfterWake = () => {
            const now = Date.now();
            if (now - lastWakeSyncAt < 15_000) return;
            lastWakeSyncAt = now;
            void window.api.sync.syncNow();
        };

        // Browser "online" is not guaranteed after system sleep. Focus and
        // visibility changes cover the common wake/resume path.
        const onOnline = () => syncAfterWake();
        const onFocus = () => syncAfterWake();
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                syncAfterWake();
            }
        };
        window.addEventListener('online', onOnline);
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            cleanupProgress();
            cleanupSuccess();
            cleanupFailure();
            window.removeEventListener('online', onOnline);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [
        aiInitialized,
        refreshAiAfterSync,
        setSubjects,
        setCustomDocuments,
        setNotes,
        setSyncing,
        setSyncProgress,
        t,
    ]);

    return null;
}
