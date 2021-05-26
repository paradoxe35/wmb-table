import { atom, selector } from 'recoil';
import { DocumentTab, OptionView, Title } from '../types';

export const MAIN_VIEWS = {
  options: 'options',
  document: 'document',
};

export const OPTIONS_VIEWS: OptionView = {
  search: 'search',
  subject: 'subject',
  history: 'history',
};

export const appViewState = atom({
  key: 'appViewerState',
  default: MAIN_VIEWS.document, // options | document
});

export const optionViewState = atom({
  key: 'optionViewState',
  default: OPTIONS_VIEWS.search as string, // options | document
});

export const documentTitles = atom<Title[]>({
  key: 'documentTitles',
  default: [], // options | document
});

export const documentTabs = atom<DocumentTab[]>({
  key: 'documentTabs',
  default: [], // options | document
});

export const currentDocumentTabs = selector<string>({
  key: 'currentDocumentTabs',
  get: ({ get }) => {
    const tab = get(documentTabs).find((v) => v.active);
    const titles = get(documentTitles);

    return tab?.title || titles[0]?.title;
  },
});
