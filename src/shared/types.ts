import { UiLanguagePreference } from './constants';

export interface BaseEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

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

export interface SermonMeta {
    id: string;
    translationId: number;
    languageCode: string;
    sermonId: string;
    title: string;
    enTitle: string;
    audioLink: string | null;
    translationName: string | null;
    dateMs: number;
    minutes: number;
    location: string | null;
    cityState: string | null;
}

export interface AvailableTranslation {
    translationId: number;
    languageCode: string;
    title: string;
    translationName: string | null;
}

export interface SermonMetaWithTranslations extends SermonMeta {
    availableTranslations: AvailableTranslation[];
}

export interface SermonTranslation {
    translationId: number;
    languageCode: string;
    title: string;
    translationName: string | null;
}

export type DocumentType = 'sermon' | 'custom' | 'bible';

export interface ReadingPosition {
    documentKey: string;
    scrollY: number;
    scrollX: number;
}

type BaseDocumentTab = {
    title: string;
    documentId: string;
    scrollY?: number;
    scrollX?: number;
    active: boolean;
    zoom?: number;
};

export type SermonTab = BaseDocumentTab & {
    type: 'sermon';
    translationId: number;
    languageCode: string;
};

export type BibleTab = BaseDocumentTab & {
    type: 'bible';
    bibleBook: string;
    bibleChapter: string;
    bibleVersionAbbreviation: string;
};

export type CustomTab = BaseDocumentTab & {
    type: 'custom';
};

export type DocumentTab = SermonTab | BibleTab | CustomTab;

export type DocumentIdentity =
    | {
          documentType: 'sermon';
          sermonId: string;
          translationId: number;
          languageCode: string;
      }
    | {
          documentType: 'bible';
          bibleBook: string;
          bibleChapter: string;
          bibleVersionAbbreviation: string;
      }
    | {
          documentType: 'custom';
          customDocumentId: string;
      };

export type SermonDocumentIdentity = Extract<DocumentIdentity, { documentType: 'sermon' }>;
export type BibleDocumentIdentity = Extract<DocumentIdentity, { documentType: 'bible' }>;

export function buildSermonDocumentIdentity(
    sermonId: string,
    translationId: number,
    languageCode: string,
): SermonDocumentIdentity {
    return {
        documentType: 'sermon',
        sermonId,
        translationId,
        languageCode,
    };
}

export function normalizeBibleAbbreviation<P extends string | null | undefined>(
    abbreviation: P,
): P {
    if (!abbreviation) {
        return abbreviation;
    }

    return abbreviation.trim().toLowerCase() as P;
}

export function getDocumentIdentityKey(identity: DocumentIdentity): string {
    switch (identity.documentType) {
        case 'sermon':
            return `sermon:${identity.languageCode}:${identity.sermonId}:${identity.translationId}`;
        case 'bible':
            return `bible:${identity.bibleBook}:${identity.bibleChapter}:${normalizeBibleAbbreviation(identity.bibleVersionAbbreviation)}`;
        case 'custom':
            return `custom:${identity.customDocumentId}`;
    }
}

export function documentIdentityEquals(left: DocumentIdentity, right: DocumentIdentity): boolean {
    return getDocumentIdentityKey(left) === getDocumentIdentityKey(right);
}

export function getDocumentIdentityFromTab(tab: DocumentTab): DocumentIdentity {
    switch (tab.type) {
        case 'custom':
            return {
                documentType: 'custom',
                customDocumentId: tab.documentId,
            };
        case 'bible':
            return {
                documentType: 'bible',
                bibleBook: tab.bibleBook,
                bibleChapter: tab.bibleChapter,
                bibleVersionAbbreviation: tab.bibleVersionAbbreviation,
            };
        case 'sermon':
            return buildSermonDocumentIdentity(tab.documentId, tab.translationId, tab.languageCode);
    }
}

export function buildBibleDocumentId(bibleBook: string, bibleChapter: string): string {
    return `${bibleBook}:${bibleChapter}`;
}

function appendBibleVersionSuffix(title: string, bibleVersionAbbreviation?: string | null): string {
    const trimmedTitle = title.trim();

    const normalizedAbbreviation = normalizeBibleAbbreviation(bibleVersionAbbreviation);
    if (!normalizedAbbreviation) {
        return trimmedTitle;
    }

    const suffix = ` (${normalizedAbbreviation.toUpperCase()})`;
    return trimmedTitle.endsWith(suffix) ? trimmedTitle : `${trimmedTitle}${suffix}`;
}

export function formatDocumentTitle(
    documentTitle: string,
    documentIdentity: DocumentIdentity,
): string {
    return documentIdentity.documentType === 'bible'
        ? appendBibleVersionSuffix(documentTitle, documentIdentity.bibleVersionAbbreviation)
        : documentTitle;
}

export function buildBibleDocumentTitle(
    bookName: string,
    bibleChapter: string,
    bibleVersionAbbreviation?: string | null,
): string {
    return appendBibleVersionSuffix(`${bookName} ${bibleChapter}`, bibleVersionAbbreviation);
}

type TabKeyInput =
    | Pick<SermonTab, 'type' | 'documentId' | 'translationId' | 'languageCode'>
    | Pick<BibleTab, 'type' | 'documentId' | 'bibleVersionAbbreviation'>
    | Pick<CustomTab, 'type' | 'documentId'>;

export function getTabKey(tab: TabKeyInput): string {
    switch (tab.type) {
        case 'sermon':
            return `sermon:${tab.documentId}:${tab.translationId}:${tab.languageCode}`;
        case 'bible':
            return `bible:${tab.documentId}:${normalizeBibleAbbreviation(tab.bibleVersionAbbreviation)}`;
        case 'custom':
            return `custom:${tab.documentId}`;
    }
}

export function tabMatches(tab: DocumentTab, candidate: TabKeyInput): boolean {
    if (tab.type !== candidate.type || tab.documentId !== candidate.documentId) {
        return false;
    }

    if (tab.type === 'sermon' && candidate.type === 'sermon') {
        return (
            tab.translationId === candidate.translationId &&
            tab.languageCode === candidate.languageCode
        );
    }

    if (tab.type === 'bible' && candidate.type === 'bible') {
        return (
            normalizeBibleAbbreviation(tab.bibleVersionAbbreviation) ===
            normalizeBibleAbbreviation(candidate.bibleVersionAbbreviation)
        );
    }

    return true;
}

export function isSermonTab(tab: DocumentTab | null): tab is SermonTab {
    return !!tab && tab.type === 'sermon';
}

export function isBibleTab(tab: DocumentTab | null): tab is BibleTab {
    return !!tab && tab.type === 'bible';
}

export function isCustomTab(tab: DocumentTab | null): tab is CustomTab {
    return !!tab && tab.type === 'custom';
}

export type DocumentTreeRanges = {
    contextualText: string | null;
    startContainer: number[];
    startToEndPath: number[][] | null;
    endContainer: number[];
    startOffset: number;
    endOffset: number;
};

export type TreeReference = {
    kind: 'tree';
    documentIdentity: DocumentIdentity;
    tree: number[];
    scrollY?: number;
    scrollX?: number;
    ranges?: DocumentTreeRanges;
};

export type ParagraphReference = {
    kind: 'paragraph';
    paragraphIndex: number;
    languageCode: string;
    textSnippet?: string;
    documentIdentity: DocumentIdentity;
};

export type DocumentReference = TreeReference | ParagraphReference;

export function buildParagraphReference(
    documentIdentity: SermonDocumentIdentity,
    paragraphIndex: number,
    textSnippet?: string,
): ParagraphReference;
export function buildParagraphReference(
    documentIdentity: Exclude<DocumentIdentity, SermonDocumentIdentity>,
    paragraphIndex: number,
    languageCode: string,
    textSnippet?: string,
): ParagraphReference;
export function buildParagraphReference(
    documentIdentity: DocumentIdentity,
    paragraphIndex: number,
    languageCodeOrTextSnippet?: string,
    textSnippet?: string,
): ParagraphReference {
    const isSermon = documentIdentity.documentType === 'sermon';
    const languageCode = isSermon ? documentIdentity.languageCode : languageCodeOrTextSnippet;

    if (!languageCode) {
        throw new Error('Missing languageCode for paragraph reference');
    }

    return {
        kind: 'paragraph',
        paragraphIndex,
        languageCode,
        textSnippet: isSermon ? languageCodeOrTextSnippet : textSnippet,
        documentIdentity,
    };
}

export function isParagraphReference(ref: DocumentReference): ref is ParagraphReference {
    return ref.kind === 'paragraph';
}

export function hasReferenceAssignment(ref?: DocumentReference | null): boolean {
    if (!ref) return false;
    return isParagraphReference(ref) || ref.tree.length > 0;
}

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
    documentTitle: string;
    textContentLength: number;
    searchForParagraph?: boolean;
    matches: SearchMatchersValue[];
    matchedParagraphs?: DocumentSearchParagraphMatch[];
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
    documentReference: DocumentReference | null;
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

export type BibleIndexEntry = {
    bookName: string;
    value: BibleIndexValue;
};

export function getBibleIndexEntry(
    bibleIndex: BibleIndex,
    bibleBook: string,
): BibleIndexEntry | null {
    for (const [bookName, value] of Object.entries(bibleIndex)) {
        if (value.book === bibleBook) {
            return { bookName, value };
        }
    }

    return null;
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
    bibleVersionAbbreviation?: string;
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

export interface SubjectDocumentItem extends Readonly<BaseEntity> {
    subjectId: string;
    sortOrder: number;
    documentTitle: string;
    documentReference: DocumentReference;
    textContent: string;
    documentPreview?: DocumentPreview;
}

export type DocumentPreview = {
    kind: 'bible-verse';
    bibleVerse: BibleBook;
};

export type DocumentReferenceSelection = {
    textContent: string;
    documentReference: DocumentReference;
    documentPreview?: DocumentPreview;
};

export interface SubjectDocument extends Readonly<BaseEntity> {
    name: string;
    date: string;
    documents: SubjectDocumentItem[];
    active?: boolean;
}

export interface HighlightParagraphRange {
    paragraphIndex: number;
    startOffset: number;
    endOffset: number;
}

export interface HighlightCreateData {
    documentTitle: string;
    documentIdentity: DocumentIdentity;
    paragraphs: HighlightParagraphRange[];
    textSnippet: string;
    color: string;
    comment?: string;
    languageCode: string;
}

export interface HighlightUpdateData {
    color?: string;
    comment?: string;
}

export interface HighlightItem extends Readonly<BaseEntity> {
    groupId: string;
    documentTitle: string;
    documentIdentity: DocumentIdentity;
    paragraphIndex: number;
    startOffset: number;
    endOffset: number;
    textSnippet: string;
    color: string;
    comment?: string;
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

export type AudioDocumentPlayRequest = {
    title: string;
    audioLink: string;
    sermonId: string;
    translationId: number | null;
    languageCode: string | null;
    languageLabel: string | null;
    autoplay?: boolean;
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
    languageCode: string;
}

export interface CustomDocumentContent {
    id: string;
    title: string;
    content: string;
    languageCode: string;
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
    documentIdentity: DocumentIdentity;
}

export interface HistoryEntryCreateData {
    documentTitle: string;
    documentIdentity: DocumentIdentity;
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

export interface DocumentSearchParagraphMatch {
    paragraphIndex: number;
    highlights?: HighlightRange[];
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
    languageCode: string;
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
    languageCode: string;
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
    activeBibleVersionAbbreviation: string | null;
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
