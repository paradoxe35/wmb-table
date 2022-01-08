import { ProgressInfo, UpdateInfo } from "electron-updater";

export interface TimeStampData<T = any> {
  _id: string;
  createdAt: T;
  updatedAt: T;
}


type OtherTraduction = {
  title:string;
  traduction:string;
  web_link:string;
}

export type Title<T = string | null, ID = string> = {
  _id: ID;
  title: string;
  frTitle: string;
  enTitle: string;
  traduction: T;
  web_link: T;
  pdf_link: T;
  audio_link?: T;
  date: T;
  date_long: T | null;
  other_traductions: OtherTraduction[];
};

export interface DataDocument extends Readonly<TimeStampData> {
  title: string;
  textContent: string;
}

export type DocumentViewQuery = {
  term: string;
  documentTitle: string;
  textContentLength: number;
  searchForParagraph?: boolean;
  matches: SearchMatchersValue[];
};

export type DocumentSearchEvent = {
  text?: string | null;
  searchForParagraph: boolean;
}

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


export type ViewMenuValue = 'options' | 'document'

export type ViewMenu = {
  [x in ViewMenuValue]: ViewMenuValue;
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

  interface Date {
    addDays: (days: number) => Date;
  }
}

export type SearchMatchersValue = {
  term: string;
  index?: number;
  start: number | undefined;
  end: number | undefined;
};
interface SearchItem {
  item: DataDocument;
  matches: SearchMatchersValue[];
  refIndex: number;
}


export interface PendingDatastore {
  _id?: string;
  dbId: string;
  deleted?: boolean;
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


export type DocumentTreeRanges = {
  contextualText: string | null;
  startContainer: number[];
  startToEndPath: number[][] | null;
  endContainer: number[];
  startOffset: number;
  endOffset: number;
}

export type DocumentHtmlTree = {
  tree: number[];
  scrollY?: number;
  scrollX?: number;
  ranges?: DocumentTreeRanges;
};

export interface SubjectDocumentItem extends Readonly<TimeStampData> {
  subject: string;
  documentTitle: string;
  documentHtmlTree: DocumentHtmlTree;
  textContent: string;
  bible?: BibleBook;
}


export type SubjectRefTree = {
  textContent: string;
  documentHtmlTree: DocumentHtmlTree;
  bible?: BibleBook;
};


export interface BackupDbReference {
  _id: string;
  filename: string;
  lines: string;
}

export interface AppSettingsStatus {
  _id: string;
  initialized: boolean;
  lastCheckBackupStatus: Date;
}

export interface BackupStatus {
  _id: string;
  email: string;
  name: string;
  active: boolean;
  access: boolean;
  restored: boolean;
  lastUpdate: Date;
}

export type ProgressionType<K extends number> = `progress-${K}`;

export type CustomDocumentUploadProgressType = 'progress' | 'finish';

export type CustomDocumentUploadProgress = {
  type: CustomDocumentUploadProgressType;
  progress: number
  total: number
}

export type RestoreProgressEventType =
  | 'start'
  | 'complete'
  | 'error'
  | 'prepare'
  | 'sauvegarde'
  | ProgressionType<number>

export interface RestoreProgressEvent {
  type: RestoreProgressEventType;
  progression: {
    proceed: number;
    total: number;
  };
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

export interface UpdaterInfoStatus extends TimeStampData<Date> {
  restartedToUpdate: boolean;
  lastUpdateCheck?: Date;
  updateInfo?: UpdateInfo;
  version?: string;
}


export interface AudioDocumentTime extends TimeStampData<Date> {
  local_file?:string;
  audio_link:string;
  time: number;
}


export type UpdaterCopyProgress = {
  elapsedBytes?: number;
  totalBytes?: number;
  progress?: number;
  speed?: number;
  remainingSecs?: number;
 }

export type UpdaterDownloadProgress = ProgressInfo

export type UpdaterProgress = {
  copyProgress?: UpdaterCopyProgress,
  downloadProgress?: UpdaterDownloadProgress
}

export type UpdaterNotification = {
    type: "none" | "preparing" | "prepared" | "restoring" | "restored" | "restartedToUpdate" | "hasUpdate" |  "downloading" | 'downloaded' | "error";
    progress?: UpdaterProgress,
    status?: Partial<UpdaterInfoStatus>;
    message?: string;
}

export type ProxyObjectFunctionValue<T> = {
  $value: T;
  get value(): T;
  set value(value: T);
  valueListener(_val: T): void;
  registerNewListener(fn: (_val: T) => void): void;
}


export type ProxyObjectFunction = <T>(value: T) => ProxyObjectFunctionValue<T>


export type CurrentAudioDocumentPlay = {
  documentTitle: string;
  status: 'play' | 'pause'
}
