import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EditorContent from './notes/editor';
import { Notes } from './notes/notes';
import { useNotesStore } from '@renderer/stores';
import { getNotesPageHelp } from './components/option-help-content';
import OptionPageLayout from './components/option-page-layout';

export default function Editor() {
    const { t } = useTranslation();
    const [workingNote, setWorkingNote] = useState<string | null>(null);
    const setWorkingNoteId = useNotesStore((s) => s.setWorkingNoteId);

    const backToNotes = () => setWorkingNote(null);

    useEffect(() => {
        setWorkingNoteId(workingNote);
    }, [workingNote, setWorkingNoteId]);

    if (workingNote) {
        return <EditorContent workingNoteId={workingNote} backToNotes={backToNotes} />;
    }

    return (
        <OptionPageLayout title={t('Notes')} help={getNotesPageHelp(t)}>
            <Notes setWorkingNote={setWorkingNote} />
        </OptionPageLayout>
    );
}
