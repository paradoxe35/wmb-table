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
  bible: 'bible',
};

export const appDatasLoaded = atom({
  key: 'appDatasLoaded',
  default: false,
});

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

export const titlesDocumentByFileName = selector<{ [fileName: string]: Title }>(
  {
    key: 'titlesDocumentByFileName',
    get: ({ get }) => {
      const titles = get(documentTitles);
      return titles.reduce((acc, doc) => {
        acc[doc.title] = doc;
        return acc;
      }, {} as { [title: string]: Title });
    },
  }
);

export const titlesGroupedByYear = selector<{ [year: string]: Title[] }>({
  key: 'titleDocumentByFileName',
  get: ({ get }) => {
    const titles = get(documentTitles);
    return titles
      .slice()
      .filter((t) => t.year)
      .sort((a, b) => a.year.localeCompare(b.year))
      .reduce((acc, v) => {
        if (!acc[v.year]) {
          acc[v.year] = [];
        }
        acc[v.year].push(v);
        return acc;
      }, {} as { [year: string]: Title[] });
  },
});

export const documentViewQuery = atom<DocumentViewQuery[]>({
  key: 'documentViewQuery',
  default: [],
});

export const sidebarStatusHidden = atom<boolean>({
  key: 'sidebarStatusHidden',
  default: true,
});

export const documentTabs = atom<DocumentTab[]>({
  key: 'documentTabs',
  default: [],
});

export const defaultTitle = {
  isDefault: false,
};

export const currentDocumentTabs = selector<string>({
  key: 'currentDocumentTabs',
  get: ({ get }) => {
    const tab = get(documentTabs).find((v) => v.active);
    const titles = get(documentTitles);
    let title = null;

    if (tab?.title) {
      defaultTitle.isDefault = false;
      title = tab?.title;
    } else {
      title = titles[0]?.title;
      defaultTitle.isDefault = true;
    }

    return title;
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

export const workingNoteApp = atom<string | null>({
  key: 'workingNoteApp',
  default: null,
});
