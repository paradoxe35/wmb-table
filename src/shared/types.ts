// Domain model types — ported from legacy src/types/index.d.ts
// removed global augmentations and renderer-only types.

import { UiLanguagePreference } from './constants';

// ---------------------------------------------------------------------------
// Base entity fields
// ---------------------------------------------------------------------------

export interface BaseEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Reference data types (from data.sqlite)
// ---------------------------------------------------------------------------

export interface RefLanguage {
    isarId: number;
    code: string;
    title: string;
    nativeTitle: string;
    audioPath: string;
    fileName: string;
    fileSize: string;
    isRtl: boolean;
    url: string;
    storageBucket: string;
    translationsSupport: boolean;
    stemmersSupported: boolean;
}

export interface RefSermon {
    isarId: number;
    id: string;
    title: string;
    titleFormatted: string;
    dateMs: number;
    minutes: number;
    location: string | null;
    cityState: string | null;
}

export interface RefTranslator {
    isarId: number;
    translatorId: number;
    name: string;
    longName: string;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface SermonMeta {
    id: string;
    translationId: number;
    languageCode: string;
    sermonId: string;
    title: string;
    enTitle: string;
    audioLink: string | null;
    traductionName: string | null;
    dateMs: number;
    minutes: number;
    location: string | null;
    cityState: string | null;
}

export interface AvailableTraduction {
    translationId: number;
    traductionName: string | null;
}

export interface SermonMetaWithTraductions extends SermonMeta {
    availableTraductions: AvailableTraduction[];
}

export interface SermonTranslation {
    languageCode: string;
    title: string;
    translatorName: string | null;
}

export type DocumentType = 'sermon' | 'custom' | 'bible';

export interface ReadingPosition {
    documentKey: string;
    scrollY: number;
    scrollX: number;
}

export type DocumentTab = {
    title: string;
    sermonId: string;
    scrollY?: number;
    scrollX?: number;
    active: boolean;
    zoom?: number;
    translationId?: number;
    languageCode?: string;
    type?: DocumentType;
    bibleBook?: string;
    bibleChapter?: string;
};

export function getTabKey(tab: { title: string; sermonId: string }): string {
    return `${tab.title}::${tab.sermonId}`;
}

export function tabMatches(tab: DocumentTab, title: string, sermonId: string): boolean {
    return tab.title === title && tab.sermonId === sermonId;
}

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

export type StoredDocumentReference = {
    documentType?: DocumentType;
    sermonId?: string;
    customDocumentId?: string;
    bibleBook?: string;
    bibleChapter?: string;
    bibleVersionAbbreviation?: string;
};

export type ParagraphReference = {
    paragraphIndex: number;
    translationId: number;
    languageCode: string;
    textSnippet?: string;
} & StoredDocumentReference;

export function isParagraphReference(
    ref: DocumentHtmlTree | ParagraphReference,
): ref is ParagraphReference {
    return 'paragraphIndex' in ref && 'translationId' in ref;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type SearchMode = 'exact' | 'all' | 'any';

export type SearchMatchersValue = {
    term: string;
    index?: number;
    start: number | undefined;
    end: number | undefined;
};

export interface Suggestions extends Readonly<BaseEntity> {
    searchText: string;
    found: number;
}

export type DocumentViewQuery = {
    term: string;
    mode: SearchMode;
    documentKey: string;
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
    documentHtmlTree: DocumentHtmlTree | ParagraphReference;
    textContent: string;
    sermonId: string;
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
    subjectId: string;
    documentTitle: string;
    documentHtmlTree: DocumentHtmlTree | ParagraphReference;
    textContent: string;
    bible?: BibleBook;
    sermonId: string;
}

export type SubjectRefTree = {
    textContent: string;
    documentHtmlTree: DocumentHtmlTree | ParagraphReference;
    bible?: BibleBook;
};

export interface SubjectDocument extends Readonly<BaseEntity> {
    name: string;
    date: string;
    documents: SubjectDocumentItem[];
    active?: boolean;
}

// ---------------------------------------------------------------------------
// Highlights
// ---------------------------------------------------------------------------

export interface HighlightParagraphRange {
    paragraphIndex: number;
    startOffset: number;
    endOffset: number;
}

export interface HighlightCreateData {
    documentTitle: string;
    sermonId: string;
    paragraphs: HighlightParagraphRange[];
    textSnippet: string;
    color: string;
    comment?: string;
    documentType: DocumentType;
    translationId: number;
    languageCode: string;
}

export interface HighlightUpdateData {
    color?: string;
    comment?: string;
}

export interface HighlightItem extends Readonly<BaseEntity> {
    groupId: string;
    documentTitle: string;
    sermonId: string;
    paragraphIndex: number;
    startOffset: number;
    endOffset: number;
    textSnippet: string;
    color: string;
    comment?: string;
    documentType: DocumentType;
    translationId: number;
    languageCode: string;
}

export interface HighlightSearchResult {
    items: HighlightItem[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
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

export interface AudioTimeAndDownload {
    time: AudioDocumentTime | null;
    download: AudioDocumentDownload | null;
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
    title: string;
    sermonId: string;
}

export interface CustomDocumentContent {
    id: string;
    title: string;
    content: string;
}

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
    sermonId: string;
    documentType: DocumentType;
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
// Sermon Content
// ---------------------------------------------------------------------------

export interface SermonParagraph {
    paragraphIndex: number;
    translationId: number;
    sermonId: number;
    content: string;
    stemmedContent?: string;
}

export interface SermonContent {
    meta: SermonMeta;
    paragraphs: SermonParagraph[];
}

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

export interface InstalledLanguage {
    code: string;
    language: string;
    enLanguage: string;
    sermonsCount: number;
    sizeOnDisk: number;
}

export interface DownloadableLanguage {
    code: string;
    language: string;
    enLanguage: string;
    sermonsAvailable: number;
    sermonsWithAudio: number;
    filesize: number;
    installed: boolean;
}

export interface LanguageDownloadProgress {
    langCode: string;
    percentage: number;
}

export interface LanguageInstalledEvent {
    langCode: string;
}

// ---------------------------------------------------------------------------
// Tantivy Search
// ---------------------------------------------------------------------------

export interface HighlightRange {
    start: number;
    end: number;
}

/** Raw paragraph snippet from Tantivy with highlight positions. */
export interface MatchingParagraphSnippet {
    paragraphIndex: number;
    snippet: string;
    highlights: HighlightRange[];
}

export interface SearchSnippet {
    paragraphIndex: number;
    snippet: string;
    matchIndex: number;
    highlights?: HighlightRange[];
}

export interface TantivySearchHit {
    translationId: number;
    sermonId: string;
    title: string;
    snippets: SearchSnippet[];
    score: number;
    hitCount: number;
    paragraphIndex: number;
}

export interface TantivySearchResult {
    hits: TantivySearchHit[];
    total: number;
    totalIsExact: boolean;
    query: string;
}

export interface SimilarParagraph {
    paragraphIndex: number;
    snippet: string;
    score: number;
}

export interface SimilarSermonHit {
    sermonId: string;
    title: string;
    translationId: number;
    paragraphs: SimilarParagraph[];
    score: number;
}

export interface SimilarSermonsResult {
    hits: SimilarSermonHit[];
    total: number;
}

// ---------------------------------------------------------------------------
// Bible Versions
// ---------------------------------------------------------------------------

export interface BibleVersionInfo {
    langCode: string;
    abbreviation: string;
    name: string;
    type: 'local' | 'remote';
    available: boolean;
}

export interface BibleDownloadProgress {
    abbreviation: string;
    percentage: number;
}

export interface BibleDownloadedEvent {
    abbreviation: string;
}

// ---------------------------------------------------------------------------
// App / Settings
// ---------------------------------------------------------------------------

export interface AppSettingsStatus {
    id: string;
    app_id: string;
    initialized: boolean;
    lastCheckBackupStatus: Date;
    contentLanguage: string | null;
    rememberReadingPosition: boolean;
    maxTabs: number;
    uiLanguage: UiLanguagePreference | null;
}

export interface SidebarStatus extends Readonly<BaseEntity> {
    hidden: boolean;
}

export type ViewMenuValue = 'options' | 'document';

export interface SyncStatus {
    enabled: boolean;
    syncing: boolean;
    lastSync: string | null;
    error: string | null;
}

export interface SyncFailureEvent {
    message: string;
    isAuthError: boolean;
    consecutiveFailures: number;
}

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

export type UpdaterNotification = {
    type: 'none' | 'noUpdate' | 'hasUpdate' | 'downloading' | 'downloaded' | 'error';
    updateInfo?: UpdateInfo;
    progress?: UpdaterProgress;
    message?: string;
    /** False on Linux deb/tar.gz where auto-update is not supported */
    canAutoUpdate?: boolean;
};
