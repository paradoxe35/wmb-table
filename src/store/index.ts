import { atom, selector } from 'recoil';

export const MAIN_VIEWS = {
  options: 'options',
  document: 'document',
};

export const appViewState = atom({
  key: 'appViewerState',
  default: MAIN_VIEWS.options, // options | document
});
