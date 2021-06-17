import { atom, selector } from 'recoil';
import {
  DocumentTab,
  DocumentViewQuery,
  OptionView,
  SubjectDocument,
  SubjectDocumentItem,
  Title,
} from '../types';

export const MAIN_VIEWS = {
  options: 'options',
  document: 'document',
};

export const OPTIONS_VIEWS: OptionView = {
  search: 'search',
  subject: 'subject',
  history: 'history',
  editor: 'editor',
};

export const appViewState = atom({
  key: 'appViewerState',
  default: MAIN_VIEWS.document,
});

export const optionViewState = atom({
  key: 'optionViewState',
  default: OPTIONS_VIEWS.search as string,
});

export const documentTitles = atom<Title[]>({
  key: 'documentTitles',
  default: [],
});

export const documentViewQuery = atom<DocumentViewQuery[]>({
  key: 'documentViewQuery',
  default: [],
});

export const documentTabs = atom<DocumentTab[]>({
  key: 'documentTabs',
  default: [],
});

export const currentDocumentTabs = selector<string>({
  key: 'currentDocumentTabs',
  get: ({ get }) => {
    const tab = get(documentTabs).find((v) => v.active);
    const titles = get(documentTitles);

    return tab?.title || titles[0]?.title;
  },
});

export const subjectDocument = atom<SubjectDocument[]>({
  key: 'subjectDocument',
  default: [],
});

export const subjectDocumentItem = atom<SubjectDocumentItem | null>({
  key: 'subjectDocumentItem',
  default: null,
});

export const selectedSubjectDocumentItem = atom<SubjectDocumentItem | null>({
  key: 'selectedSubjectDocumentItem',
  default: null,
});
