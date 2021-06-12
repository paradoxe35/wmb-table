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

type SearchMatchersValue = {
  term: string;
  start: number | undefined;
  end: number | undefined;
};
interface SearchItem {
  item: DataDocument;
  matches: SearchMatchersValue[];
  refIndex: number;
}

export interface SearchResult {
  data: SearchItem[];
  end: boolean;
  itemsPerPage: number;
  pageNumber: number;
  total: number;
}
