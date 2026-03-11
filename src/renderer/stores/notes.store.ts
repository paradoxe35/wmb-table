import { create } from 'zustand';

interface NotesState {
    workingNoteId: string | null;
    error: string | null;
    setWorkingNoteId(id: string | null): void;
    setError(error: string | null): void;
}

export const useNotesStore = create<NotesState>((set) => ({
    workingNoteId: null,
    error: null,
    setWorkingNoteId: (id) => set({ workingNoteId: id }),
    setError: (error) => set({ error }),
}));
