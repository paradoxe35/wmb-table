import { atom, selector } from 'recoil';
import { DocumentTab, Title } from '../types';

export const MAIN_VIEWS = {
  options: 'options',
  document: 'document',
};

export const appViewState = atom({
  key: 'appViewerState',
  default: MAIN_VIEWS.options, // options | document
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
