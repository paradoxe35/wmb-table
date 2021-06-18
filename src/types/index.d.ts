export type Title = { _id: string; title: string };

export type DataDocument = {
  _id?: string;
  title: string;
  textContent: string;
};

export type DocumentViewQuery = {
  term: string;
  documentTitle: string;
  matches: SearchMatchersValue[];
};

export type DocumentTab = {
  title: string;
  scrollY?: number;
  scrollX?: number;
  active: boolean;
};

export type OptionView = {
  search: string | JSX.Element;
  subject: string | JSX.Element;
  history: string | JSX.Element;
  editor: string | JSX.Element;
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

export type SearchMatchersValue = {
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
  query: string;
  pageNumber: number;
  total: number;
}

export type SubjectDocumentItem = {
  _id?: string;
  subject: string;
  documentTitle: string;
  documentHtmlTree: number[];
  textContent: string;
};

export interface SubjectDocument {
  _id?: string;
  name: string;
  date: string;
  documents: SubjectDocumentItem[];
  active?: boolean;
}

export interface SubjectDoc {
  _id: string;
  name: string;
  date: string;
}

export type CustomDocument = {
  _id?: string;
  documentId: string;
  title: string;
};

export type UploadDocument = {
  name: string;
  path: string;
};

export type HistoryData = {
  _id?: string;
  date: string;
};

export type HistoryDataItem = {
  _id?: string;
  historyId: string;
  date: string;
  time: string;
  documentTitle: string;
};

export type HistoryDateUpload = {
  date: string;
  time: string;
  documentTitle: string;
};
