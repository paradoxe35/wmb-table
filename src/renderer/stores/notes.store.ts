import type { NoteItem } from '@shared/types';
import { createStore } from './create-store';

interface NotesState {
    notes: NoteItem[];
    workingNoteId: string | null;
    error: string | null;
    setNotes(notes: NoteItem[]): void;
    setWorkingNoteId(id: string | null): void;
    setError(error: string | null): void;
}

export const useNotesStore = createStore<NotesState>((set) => ({
    notes: [],
    workingNoteId: null,
    error: null,
    setNotes: (notes) => set({ notes }),
    setWorkingNoteId: (id) => set({ workingNoteId: id }),
    setError: (error) => set({ error }),
}));
