import React, { useState } from 'react';
import EditorContent from './notes/editor';
import { Notes } from './notes/notes';

export default function Editor() {
  const [workingNote, setWorkingNote] = useState<string | null>(null);

  const backToNotes = () => setWorkingNote(null);

  return (
    <>
      {!workingNote && <Notes setWorkingNote={setWorkingNote} />}
      {workingNote && (
        <EditorContent workingNoteId={workingNote} backToNotes={backToNotes} />
      )}
    </>
  );
}
