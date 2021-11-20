import { atom, selector } from 'recoil';
import {
  CurrentAudioDocumentPlay,
  CustomDocument,
  DocumentTab,
  DocumentViewQuery,
  OptionView,
  SubjectDocument,
  SubjectDocumentItem,
  Title,
  ViewMenu,
  ViewMenuValue,
} from '@localtypes/index';
import DocumentTitle from './models/document_title';

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

export const titlesStore = atom<Title[]>({
  key: 'titlesStore',
  default: [],
});

export const documentTitlesStore = selector<DocumentTitle[]>({
  key: 'documentTitlesStore',
  get: ({ get }) => {
    const titles = get(titlesStore);
    return titles.map((doc) => new DocumentTitle(doc));
  },
});

export const customDocumentsStore = atom<CustomDocument[]>({
  key: 'customDocumentsStore',
  default: [],
});

export const titlesDocumentSelector = selector<{
  [fileName: string]: DocumentTitle;
}>({
  key: 'titlesDocumentSelector',
  get: ({ get }) => {
    const titles = get(titlesStore);

    return titles.reduce((acc, doc) => {
      acc[doc.title] = new DocumentTitle(doc);
      return acc;
    }, {} as { [title: string]: DocumentTitle });
  },
});

export const titlesGroupedByYearSelector = selector<{
  [year: string]: DocumentTitle[];
}>({
  key: 'titleDocumentByFileName',
  get: ({ get }) => {
    const titles = get(documentTitlesStore);
    return titles
      .slice()
      .filter((t) => t.getYear())
      .sort((a, b) => a.getYear<string>().localeCompare(b.getYear()))
      .reduce((acc, v) => {
        if (!acc[v.getYear<string>()]) {
          acc[v.getYear<string>()] = [];
        }
        acc[v.getYear<string>()].push(v);
        return acc;
      }, {} as { [year: string]: DocumentTitle[] });
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
      title = tab.title;
    } else {
      title = titles[0]?.getTitle();
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

export const currentAudioDocumentPlayStore = atom<CurrentAudioDocumentPlay | null>(
  {
    key: 'currentAudioDocumentPlay',
    default: null,
  }
);
