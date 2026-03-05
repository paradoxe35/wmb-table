import { create } from 'zustand';

interface NotesState {
    workingNoteId: string | null;
    setWorkingNoteId(id: string | null): void;
}

export const useNotesStore = create<NotesState>((set) => ({
    workingNoteId: null,
    setWorkingNoteId: (id) => set({ workingNoteId: id }),
}));
