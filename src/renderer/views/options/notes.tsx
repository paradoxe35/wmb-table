import { useEffect, useState } from 'react';
import EditorContent from './notes/editor';
import { Notes } from './notes/notes';
import { useNotesStore } from '@renderer/stores';

export default function Editor() {
    const [workingNote, setWorkingNote] = useState<string | null>(null);
    const setWorkingNoteId = useNotesStore((s) => s.setWorkingNoteId);

    const backToNotes = () => setWorkingNote(null);

    useEffect(() => {
        setWorkingNoteId(workingNote);
    }, [workingNote, setWorkingNoteId]);

    return (
        <>
            {!workingNote && <Notes setWorkingNote={setWorkingNote} />}
            {workingNote && <EditorContent workingNoteId={workingNote} backToNotes={backToNotes} />}
        </>
    );
}
