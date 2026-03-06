import { create } from 'zustand';
import type { SubjectDocument, SubjectDocumentItem } from '@shared/types';

interface SubjectsState {
    subjects: SubjectDocument[];
    activeSubject: SubjectDocumentItem | null;

    setSubjects(s: SubjectDocument[]): void;
    setActiveSubject(s: SubjectDocumentItem | null): void;
}

export const useSubjectsStore = create<SubjectsState>((set) => ({
    subjects: [],
    activeSubject: null,

    setSubjects: (s) => set({ subjects: s }),
    setActiveSubject: (s) => set({ activeSubject: s }),
}));
