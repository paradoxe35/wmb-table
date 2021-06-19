interface TimeStampData {
  _id: string;
  createdAt: any;
  updatedAt: any;
}

export type Title = { _id: string; title: string };

export interface DataDocument extends Readonly<TimeStampData> {
  title: string;
  textContent: string;
}

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

export interface Suggestions extends Readonly<TimeStampData> {
  searchText: string;
  found: number;
}

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

export interface SubjectDocumentItem extends Readonly<TimeStampData> {
  subject: string;
  documentTitle: string;
  documentHtmlTree: number[];
  textContent: string;
}

export interface SubjectDocument extends Readonly<TimeStampData> {
  name: string;
  date: string;
  documents: SubjectDocumentItem[];
  active?: boolean;
}

export interface CustomDocument extends Readonly<TimeStampData> {
  documentId: string;
  title: string;
}

export type UploadDocument = {
  name: string;
  path: string;
};

export interface HistoryData extends Readonly<TimeStampData> {
  date: string;
  milliseconds: number;
}

export interface HistoryDataItem extends Readonly<TimeStampData> {
  historyId: string;
  date: string;
  time: string;
  documentTitle: string;
}

export type HistoryDateUpload = {
  milliseconds: number;
  date: string;
  time: string;
  documentTitle: string;
};

export interface NoteItem extends Readonly<TimeStampData> {
  name: string;
  content?: string;
  defaultName: boolean;
}

export interface NoteItemReference extends Readonly<TimeStampData> {
  noteId: string;
  documentTitle: string;
  textContent: string;
}
