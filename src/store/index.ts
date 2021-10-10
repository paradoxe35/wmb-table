import { atom, selector } from 'recoil';
import {
  CustomDocument,
  DocumentTab,
  DocumentViewQuery,
  OptionView,
  SubjectDocument,
  SubjectDocumentItem,
  Title,
  ViewMenu,
  ViewMenuValue,
} from '../types';

export const MAIN_VIEWS: ViewMenu = {
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

export const appDatasLoadedStore = atom({
  key: 'appDatasLoadedStore',
  default: false,
});

export const appViewStore = atom<ViewMenuValue>({
  key: 'appViewerState',
  default: MAIN_VIEWS.document,
});

export const optionViewStore = atom({
  key: 'optionViewStore',
  default: OPTIONS_VIEWS.search as string,
});

export const documentTitlesStore = atom<Title[]>({
  key: 'documentTitlesStore',
  default: [],
});

export const customDocumentsStore = atom<CustomDocument[]>({
  key: 'customDocumentsStore',
  default: [],
});

export const titlesDocumentSelector = selector<{
  [fileName: string]: Title;
}>({
  key: 'titlesDocumentSelector',
  get: ({ get }) => {
    const titles = get(documentTitlesStore);
    return titles.reduce((acc, doc) => {
      acc[doc.title] = doc;
      return acc;
    }, {} as { [title: string]: Title });
  },
});

export const titlesGroupedByYearSelector = selector<{
  [year: string]: Title[];
}>({
  key: 'titleDocumentByFileName',
  get: ({ get }) => {
    const titles = get(documentTitlesStore);
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

export const documentViewQueryStore = atom<DocumentViewQuery[]>({
  key: 'documentViewQueryStore',
  default: [],
});

export const sidebarStatusHiddenStore = atom<boolean>({
  key: 'sidebarStatusHiddenStore',
  default: true,
});

export const documentTabsStore = atom<DocumentTab[]>({
  key: 'documentTabsStore',
  default: [],
});

export const defaultTitle = {
  isDefault: false,
};

export const currentDocumentTabsSelector = selector<string>({
  key: 'currentDocumentTabsSelector',
  get: ({ get }) => {
    const tab = get(documentTabsStore).find((v) => v.active);
    const titles = get(documentTitlesStore);
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

export const subjectDocumentStore = atom<SubjectDocument[]>({
  key: 'subjectDocumentStore',
  default: [],
});

export const subjectDocumentItemStore = atom<SubjectDocumentItem | null>({
  key: 'subjectDocumentItemStore',
  default: null,
});

export const selectedSubjectDocumentItemStore = atom<SubjectDocumentItem | null>(
  {
    key: 'selectedSubjectDocumentItemStore',
    default: null,
  }
);

export const workingNoteAppStore = atom<string | null>({
  key: 'workingNoteAppStore',
  default: null,
});
