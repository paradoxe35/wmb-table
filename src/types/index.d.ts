export type Title = { _id: string; title: string };

export type DataDocument = {
  _id?: string;
  title: string;
  textContent: string;
};

export type DocumentTab = {
  title: string;
  scrollY?: number;
  active: boolean;
};

export type OptionView = {
  search: string | JSX.Element;
  subject: string | JSX.Element;
  history: string | JSX.Element;
};

export type HandlerIPC = (event: Electron.IpcMainEvent, ...args: []) => any;

export type Suggestions = {
  searchText: string;
  found: number;
};

declare global {
  interface Array<T> {
    paginate: <T>(
      pageNumber: number,
      itemsPerPage: number
    ) => { data: T[]; end: boolean };
  }
}

type FuseSearchMatchersValue = {
  indices: [number, number][];
  key: string;
  value: string;
};
interface FuseSearchItem {
  item: DataDocument;
  matches: FuseSearchMatchersValue[];
  refIndex: number;
  score: number;
}

export interface FuseSearchResult {
  data: FuseSearchItem[];
  end: boolean;
  itemsPerPage: number;
  pageNumber: number;
  total: number;
}
