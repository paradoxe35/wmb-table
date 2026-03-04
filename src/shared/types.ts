// Domain model types — ported from legacy src/types/index.d.ts
// Changes: removed NeDB TimeStampData base, _id → id, inlined updater types,
// removed global augmentations and renderer-only types.

// ---------------------------------------------------------------------------
// Base entity fields (replaces NeDB TimeStampData)
// ---------------------------------------------------------------------------

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type OtherTraduction = {
  title: string;
  traduction: string;
  web_link: string;
};

export type Title<T = string | null> = {
  id: string;
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

export interface DataDocument extends Readonly<BaseEntity> {
  title: string;
  textContent: string;
}

export type DocumentTab = {
  title: string;
  scrollY?: number;
  scrollX?: number;
  active: boolean;
  zoom?: number;
};

export type DocumentTreeRanges = {
  contextualText: string | null;
  startContainer: number[];
  startToEndPath: number[][] | null;
  endContainer: number[];
  startOffset: number;
  endOffset: number;
};

export type DocumentHtmlTree = {
  tree: number[];
  scrollY?: number;
  scrollX?: number;
  ranges?: DocumentTreeRanges;
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type SearchMatchersValue = {
  term: string;
  index?: number;
  start: number | undefined;
  end: number | undefined;
};

export interface SearchItem {
  item: DataDocument;
  matches: SearchMatchersValue[];
  refIndex: number;
}

export interface SearchResult {
  end: boolean;
  itemsPerPage: number;
  query: string;
  pageNumber: number;
  total: number;
  data: SearchItem[];
}

export interface Suggestions extends Readonly<BaseEntity> {
  searchText: string;
  found: number;
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
};

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export interface NoteItem extends Readonly<BaseEntity> {
  name: string;
  content?: string;
  defaultName: boolean;
  created: boolean;
}

export interface NoteItemReference extends Readonly<BaseEntity> {
  label: string;
  noteId: string;
  documentTitle: string;
  documentHtmlTree: DocumentHtmlTree;
  textContent: string;
}

export interface NoteItemReferenceBible extends Readonly<BaseEntity> {
  label: string;
  noteId: string;
  references: BibleBook[] | string[];
}

// ---------------------------------------------------------------------------
// Bible
// ---------------------------------------------------------------------------

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
  id: string;
  bookName: string;
  book: string;
  testament: string;
  chapter: string;
  verse: string;
  content: string;
}

export type BookRequest = {
  book: string;
  chapter: string;
  verse?: string;
};

export interface BibleSearchItem {
  item: BibleBook;
  matches: SearchMatchersValue[];
  refIndex: number;
}

export interface BibleSearchResult {
  end: boolean;
  itemsPerPage: number;
  query: string;
  pageNumber: number;
  total: number;
  data: BibleSearchItem[];
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export interface SubjectDocumentItem extends Readonly<BaseEntity> {
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

export interface SubjectDocument extends Readonly<BaseEntity> {
  name: string;
  date: string;
  documents: SubjectDocumentItem[];
  active?: boolean;
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

export interface AudioDocumentTime extends BaseEntity {
  audio_link: string;
  time: number;
}

export interface AudioDocumentDownload extends BaseEntity {
  local_file?: string;
  audio_link: string;
}

export type AudioDownloadProgress = {
  document_title: string;
  percentage: number;
};

export type CurrentAudioDocumentPlay = {
  documentTitle: string;
  status: 'play' | 'pause';
};

// ---------------------------------------------------------------------------
// Custom documents
// ---------------------------------------------------------------------------

export interface CustomDocument extends Readonly<BaseEntity> {
  documentId: string;
  title: string;
}

export type UploadDocument = {
  name: string;
  path: string;
};

export type CustomDocumentUploadProgressType = 'progress' | 'finish';

export type CustomDocumentUploadProgress = {
  type: CustomDocumentUploadProgressType;
  progress: number;
  total: number;
};

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface HistoryData extends Readonly<BaseEntity> {
  date: string;
  milliseconds: number;
}

export interface HistoryDataItem extends Readonly<BaseEntity> {
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

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export interface BackupDbReference {
  id: string;
  filename: string;
  lines: string;
}

export interface BackupStatus {
  id: string;
  email: string;
  name: string;
  active: boolean;
  access: boolean;
  restored: boolean;
  lastUpdate: Date;
}

export type RestoreProgressEventType =
  | 'start'
  | 'complete'
  | 'error'
  | 'prepare'
  | 'sauvegarde'
  | `progress-${number}`;

export interface RestoreProgressEvent {
  type: RestoreProgressEventType;
  progression: {
    proceed: number;
    total: number;
  };
}

// ---------------------------------------------------------------------------
// App / Settings
// ---------------------------------------------------------------------------

export interface AppSettingsStatus {
  id: string;
  app_id: string;
  initialized: boolean;
  lastCheckBackupStatus: Date;
}

export interface SidebarStatus extends Readonly<BaseEntity> {
  hidden: boolean;
}

export type ViewMenuValue = 'options' | 'document';

// ---------------------------------------------------------------------------
// Updater (inlined — no electron-updater import)
// ---------------------------------------------------------------------------

export type UpdaterDownloadProgress = {
  total: number;
  delta: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
};

export type UpdaterProgress = {
  downloadProgress?: UpdaterDownloadProgress;
};

export type UpdateInfo = {
  version: string;
  releaseDate: string;
  releaseName?: string | null;
  releaseNotes?: string | null;
};

export interface UpdaterInfoStatus extends BaseEntity {
  restartedToUpdate: boolean;
  lastUpdateCheck?: Date;
  updateInfo?: UpdateInfo;
  version?: string;
}

export type UpdaterNotification = {
  type: 'none' | 'hasUpdate' | 'downloading' | 'downloaded' | 'error';
  progress?: UpdaterProgress;
  status?: Partial<UpdaterInfoStatus>;
  message?: string;
};
