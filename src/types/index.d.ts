interface TimeStampData {
  _id: string;
  createdAt: any;
  updatedAt: any;
}

export type Title = {
  _id: string;
  title: string;
  name: string;
  year: string;
};

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
  zoom?: number;
};

export type OptionView = {
  search: string | JSX.Element;
  subject: string | JSX.Element;
  history: string | JSX.Element;
  editor: string | JSX.Element;
  bible: string | JSX.Element;
};

export type HandlerIPC = (event: Electron.IpcMainEvent, ...args: []) => any;

export interface Suggestions extends Readonly<TimeStampData> {
  searchText: string;
  found: number;
}

export interface SidebarStatus extends Readonly<TimeStampData> {
  hidden: boolean;
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

interface SearchResultStructure {
  end: boolean;
  itemsPerPage: number;
  query: string;
  pageNumber: number;
  total: number;
}

export interface SearchResult extends SearchResultStructure {
  data: SearchItem[];
}

export type DocumentHtmlTree = {
  tree: number[];
  scrollY?: number;
  scrollX?: number;
};

export interface SubjectDocumentItem extends Readonly<TimeStampData> {
  subject: string;
  documentTitle: string;
  documentHtmlTree: DocumentHtmlTree;
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
  created: boolean;
}

export interface NoteItemReference extends Readonly<TimeStampData> {
  label: string;
  noteId: string;
  documentTitle: string;
  documentHtmlTree: DocumentHtmlTree;
  textContent: string;
}

export interface NoteItemReferenceBible extends Readonly<TimeStampData> {
  label: string;
  noteId: string;
  references: BibleBook[] | string[];
}

export type BibleIndexValue = {
  book: string;
  chapters: string;
  verses: string;
  testament: string;
};

export interface BibleIndex {
  [x: string]: BibleIndexValue;
}

export interface BibleBook {
  _id: Readonly<string>;
  bookName: Readonly<string>;
  book: Readonly<string>;
  testament: Readonly<string>;
  chapter: Readonly<string>;
  verse: Readonly<string>;
  content: Readonly<string>;
}

export type BookRequest = {
  book: string;
  chapter: string;
  verse?: string;
};

interface BibleSearchItem {
  item: BibleBook;
  matches: SearchMatchersValue[];
  refIndex: number;
}

export interface BibleSearchResult extends SearchResultStructure {
  data: BibleSearchItem[];
}
