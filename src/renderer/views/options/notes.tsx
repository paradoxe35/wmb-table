import React, { useEffect, useState } from 'react';
import EditorContent from './notes/editor';
import { Notes } from './notes/notes';
import { useSetRecoilState } from 'recoil';
import { workingNoteAppStore } from '@renderer/store';

export default function Editor() {
  const [workingNote, setWorkingNote] = useState<string | null>(null);
  const setWorkingNoteApp = useSetRecoilState(workingNoteAppStore);

  const backToNotes = () => setWorkingNote(null);

  useEffect(() => {
    setWorkingNoteApp(workingNote);
  }, [workingNote]);

  return (
    <>
      {!workingNote && <Notes setWorkingNote={setWorkingNote} />}
      {workingNote && (
        <EditorContent workingNoteId={workingNote} backToNotes={backToNotes} />
      )}
    </>
  );
}
