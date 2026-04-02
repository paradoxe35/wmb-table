import type { SubjectDocument, SubjectDocumentItem } from '@shared/types';
import { createStore } from './create-store';

interface SubjectsState {
    subjects: SubjectDocument[];
    activeSubject: SubjectDocumentItem | null;
    error: string | null;

    setSubjects(s: SubjectDocument[]): void;
    setActiveSubject(s: SubjectDocumentItem | null): void;
    setError(error: string | null): void;
}

export const useSubjectsStore = createStore<SubjectsState>((set) => ({
    subjects: [],
    activeSubject: null,
    error: null,

    setSubjects: (s) => set({ subjects: s }),
    setActiveSubject: (s) => set({ activeSubject: s }),
    setError: (error) => set({ error }),
}));
