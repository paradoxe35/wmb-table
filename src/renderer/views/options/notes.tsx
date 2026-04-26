import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EditorContent from './notes/editor-tiptap';
import { Notes } from './notes/notes';
import { useNotesStore } from '@renderer/stores';
import { getNotesPageHelp } from './components/option-help-content';
import OptionPageLayout from './components/option-page-layout';
import { useResolvedUiLanguage } from '@renderer/hooks';
import { AI_DATA_EVENT } from '@renderer/utils/events';

export default function Editor() {
    const { t } = useTranslation();
    const [workingNote, setWorkingNote] = useState<string | null>(null);
    const [noteRefreshKey, setNoteRefreshKey] = useState(0);
    const setWorkingNoteId = useNotesStore((s) => s.setWorkingNoteId);
    const uiLanguage = useResolvedUiLanguage();

    const backToNotes = () => setWorkingNote(null);

    useEffect(() => {
        setWorkingNoteId(workingNote);
    }, [workingNote, setWorkingNoteId]);

    useEffect(() => {
        const refreshOpenNote = () => {
            if (workingNote) {
                setNoteRefreshKey((key) => key + 1);
            }
        };

        window.addEventListener(AI_DATA_EVENT.notesChanged, refreshOpenNote);
        return () => {
            window.removeEventListener(AI_DATA_EVENT.notesChanged, refreshOpenNote);
        };
    }, [workingNote]);

    if (workingNote) {
        return (
            <EditorContent
                key={`${uiLanguage}:${noteRefreshKey}`}
                uiLanguage={uiLanguage}
                workingNoteId={workingNote}
                backToNotes={backToNotes}
            />
        );
    }

    return (
        <OptionPageLayout title={t('Notes')} help={getNotesPageHelp(t)}>
            <Notes setWorkingNote={setWorkingNote} />
        </OptionPageLayout>
    );
}
