import type {
    DocumentTab,
    Suggestions,
    SidebarStatus,
    NoteItem,
    NoteItemReference,
    NoteItemReferenceBible,
    BibleIndex,
    BibleBook,
    BookRequest,
    BibleSearchResult,
    BibleVersionInfo,
    SubjectDocument,
    SubjectDocumentItem,
    SubjectRefTree,
    CustomDocument,
    CustomDocumentContent,
    HistoryData,
    HistoryDataItem,
    AudioDocumentTime,
    AudioDocumentDownload,
    AudioDownloadProgress,
    BackupStatus,
    RestoreProgressEvent,
    UpdaterNotification,
    ViewMenuValue,
    DocumentHtmlTree,
    ParagraphReference,
    SermonMeta,
    SermonMetaWithTraductions,
    SermonContent,
    InstalledLanguage,
    DownloadableLanguage,
    TantivySearchResult,
    LanguageDownloadProgress,
    SyncStatus,
} from './types';

// ---------------------------------------------------------------------------
// Invoke channels — renderer → main (request/response via ipcRenderer.invoke)
// ---------------------------------------------------------------------------

export const DocumentChannels = {
    getTitles: 'documents:getTitles',
    getSermonContent: 'documents:getSermonContent',
    getSermonList: 'documents:getSermonList',
    getSermonsByYear: 'documents:getSermonsByYear',
    getTranslations: 'documents:getTranslations',
    getTraductionsForSermon: 'documents:getTraductionsForSermon',
    getTabs: 'documents:getTabs',
    saveTabs: 'documents:saveTabs',
} as const;

export const LanguageChannels = {
    getInstalled: 'languages:getInstalled',
    getAvailable: 'languages:getAvailable',
    install: 'languages:install',
    delete: 'languages:delete',
} as const;

export const SearchChannels = {
    getSuggestions: 'search:getSuggestions',
    addSuggestion: 'search:addSuggestion',
    searchText: 'search:searchText',
    searchContent: 'search:searchContent',
} as const;

export const NotesChannels = {
    getAll: 'notes:getAll',
    getById: 'notes:getById',
    create: 'notes:create',
    delete: 'notes:delete',
    rename: 'notes:rename',
    updateContent: 'notes:updateContent',
    getReferences: 'notes:getReferences',
    createReference: 'notes:createReference',
    getReference: 'notes:getReference',
    syncReferences: 'notes:syncReferences',
    updateReference: 'notes:updateReference',
    getBibleReference: 'notes:getBibleReference',
    getBibleReferences: 'notes:getBibleReferences',
    createBibleReference: 'notes:createBibleReference',
    syncBibleReferences: 'notes:syncBibleReferences',
    addBibleVerse: 'notes:addBibleVerse',
    removeBibleVerse: 'notes:removeBibleVerse',
    exportPdf: 'notes:exportPdf',
} as const;

export const BibleChannels = {
    getIndexes: 'bible:getIndexes',
    getBooks: 'bible:getBooks',
    search: 'bible:search',
    getVersions: 'bible:getVersions',
    getAllVersions: 'bible:getAllVersions',
    getActiveVersion: 'bible:getActiveVersion',
    switchVersion: 'bible:switchVersion',
    downloadVersion: 'bible:downloadVersion',
    refreshIndex: 'bible:refreshIndex',
} as const;

export const SubjectChannels = {
    getAll: 'subjects:getAll',
    create: 'subjects:create',
    delete: 'subjects:delete',
    getItems: 'subjects:getItems',
    deleteItem: 'subjects:deleteItem',
    createItem: 'subjects:createItem',
} as const;

export const AudioChannels = {
    getTimeAndLocalFile: 'audio:getTimeAndLocalFile',
    setTime: 'audio:setTime',
    getLastPlay: 'audio:getLastPlay',
    setLastPlay: 'audio:setLastPlay',
} as const;

export const BackupChannels = {
    getStatus: 'backup:getStatus',
    toggleStatus: 'backup:toggleStatus',
    getReminder: 'backup:getReminder',
    login: 'backup:login',
} as const;

export const SyncChannels = {
    getStatus: 'sync:getStatus',
} as const;

export const AppChannels = {
    initialize: 'app:initialize',
    getActiveLanguage: 'app:getActiveLanguage',
    setActiveLanguage: 'app:setActiveLanguage',
    restart: 'app:restart',
    getUpdateStatus: 'app:getUpdateStatus',
    startDownloadUpdate: 'app:startDownloadUpdate',
    quitAndInstallUpdate: 'app:quitAndInstallUpdate',
    getSidebarStatus: 'app:getSidebarStatus',
    setSidebarStatus: 'app:setSidebarStatus',
    getCustomDocuments: 'app:getCustomDocuments',
    deleteCustomDocument: 'app:deleteCustomDocument',
    createCustomDocument: 'app:createCustomDocument',
    getCustomDocumentContent: 'app:getCustomDocumentContent',
    getHistory: 'app:getHistory',
    getHistoryItems: 'app:getHistoryItems',
} as const;

// ---------------------------------------------------------------------------
// Push channels — main → renderer (one-way events via webContents.send)
// ---------------------------------------------------------------------------

export const PushChannels = {
    openModalDocumentFromMain: 'push:openModalDocumentFromMain',
    backupProgression: 'push:backupProgression',
    backupAccessStatus: 'push:backupAccessStatus',
    openBackupModalFromMain: 'push:openBackupModalFromMain',
    appUpdateMenu: 'push:appUpdateMenu',
    toggleSidebar: 'push:toggleSidebar',
    switchOnMenu: 'push:switchOnMenu',
    notifyForNewUpdate: 'push:notifyForNewUpdate',
    switchOnOptions: 'push:switchOnOptions',
    changeMenuViewer: 'push:changeMenuViewer',
    downloadAudioProgress: 'push:downloadAudioProgress',
    newSynchronizedDatas: 'push:newSynchronizedDatas',
    openLanguageManager: 'push:openLanguageManager',
    languageDownloadProgress: 'push:languageDownloadProgress',
    languageInstalled: 'push:languageInstalled',
    bibleDownloadProgress: 'push:bibleDownloadProgress',
    bibleDownloaded: 'push:bibleDownloaded',
} as const;

// ---------------------------------------------------------------------------
// Type maps
// ---------------------------------------------------------------------------

/** Maps each invoke channel to its argument tuple and return type. */
export interface InvokeChannelMap {
    // Documents
    [DocumentChannels.getTitles]: { args: [string]; return: SermonMetaWithTraductions[] };
    [DocumentChannels.getSermonContent]: {
        args: [string, number, string];
        return: SermonContent;
    };
    [DocumentChannels.getSermonList]: { args: [string, { year?: string }?]; return: SermonMeta[] };
    [DocumentChannels.getSermonsByYear]: { args: [string]; return: Record<string, SermonMeta[]> };
    [DocumentChannels.getTranslations]: {
        args: [string];
        return: { languageCode: string; title: string; translatorName: string | null }[];
    };
    [DocumentChannels.getTraductionsForSermon]: {
        args: [string, string];
        return: SermonMeta[];
    };
    [DocumentChannels.getTabs]: { args: []; return: DocumentTab[] };
    [DocumentChannels.saveTabs]: { args: [DocumentTab[]]; return: void };

    // Languages
    [LanguageChannels.getInstalled]: { args: []; return: InstalledLanguage[] };
    [LanguageChannels.getAvailable]: { args: []; return: DownloadableLanguage[] };
    [LanguageChannels.install]: { args: [string]; return: void };
    [LanguageChannels.delete]: { args: [string]; return: void };

    // Search
    [SearchChannels.getSuggestions]: { args: []; return: Suggestions[] };
    [SearchChannels.addSuggestion]: { args: [string, number]; return: Suggestions };
    [SearchChannels.searchText]: { args: [string, string, number]; return: TantivySearchResult };
    [SearchChannels.searchContent]: {
        args: [string, string, number];
        return: string;
    };

    // Notes
    [NotesChannels.getAll]: { args: []; return: NoteItem[] };
    [NotesChannels.getById]: { args: [string]; return: NoteItem | null };
    [NotesChannels.create]: { args: [string]; return: NoteItem };
    [NotesChannels.delete]: { args: [string]; return: void };
    [NotesChannels.rename]: { args: [string, string]; return: NoteItem };
    [NotesChannels.updateContent]: { args: [string, string]; return: void };
    [NotesChannels.getReferences]: { args: [string]; return: NoteItemReference[] };
    [NotesChannels.createReference]: {
        args: [string, string, DocumentHtmlTree | ParagraphReference, string];
        return: NoteItemReference;
    };
    [NotesChannels.getReference]: { args: [string]; return: NoteItemReference | null };
    [NotesChannels.syncReferences]: {
        args: [string, string[]];
        return: void;
    };
    [NotesChannels.updateReference]: {
        args: [string, SubjectRefTree];
        return: void;
    };
    [NotesChannels.getBibleReference]: {
        args: [string];
        return: NoteItemReferenceBible | null;
    };
    [NotesChannels.getBibleReferences]: {
        args: [string];
        return: NoteItemReferenceBible[];
    };
    [NotesChannels.createBibleReference]: {
        args: [string, string];
        return: NoteItemReferenceBible;
    };
    [NotesChannels.syncBibleReferences]: {
        args: [string, BibleBook[] | string[]];
        return: void;
    };
    [NotesChannels.addBibleVerse]: {
        args: [string, string];
        return: BibleBook | null;
    };
    [NotesChannels.removeBibleVerse]: {
        args: [string, string];
        return: void;
    };
    [NotesChannels.exportPdf]: { args: [string]; return: string };

    // Bible
    [BibleChannels.getIndexes]: { args: []; return: BibleIndex };
    [BibleChannels.getBooks]: { args: [BookRequest]; return: BibleBook[] };
    [BibleChannels.search]: { args: [string, number]; return: BibleSearchResult };
    [BibleChannels.getVersions]: { args: []; return: BibleVersionInfo[] };
    [BibleChannels.getAllVersions]: { args: []; return: BibleVersionInfo[] };
    [BibleChannels.getActiveVersion]: { args: []; return: BibleVersionInfo | null };
    [BibleChannels.switchVersion]: { args: [string]; return: void };
    [BibleChannels.downloadVersion]: { args: [string]; return: void };
    [BibleChannels.refreshIndex]: { args: []; return: BibleVersionInfo[] };

    // Subjects
    [SubjectChannels.getAll]: { args: []; return: SubjectDocument[] };
    [SubjectChannels.create]: { args: [string]; return: SubjectDocument };
    [SubjectChannels.delete]: { args: [string]; return: void };
    [SubjectChannels.getItems]: { args: [string]; return: SubjectDocumentItem[] };
    [SubjectChannels.deleteItem]: { args: [string]; return: void };
    [SubjectChannels.createItem]: {
        args: [string, string, DocumentHtmlTree | ParagraphReference, string, BibleBook?];
        return: SubjectDocumentItem;
    };

    // Audio
    [AudioChannels.getTimeAndLocalFile]: {
        args: [string];
        return: { time: AudioDocumentTime | null; download: AudioDocumentDownload | null };
    };
    [AudioChannels.setTime]: { args: [string, number]; return: void };
    [AudioChannels.getLastPlay]: { args: []; return: string | null };
    [AudioChannels.setLastPlay]: { args: [string]; return: void };

    // Backup
    [BackupChannels.getStatus]: { args: []; return: BackupStatus | null };
    [BackupChannels.toggleStatus]: { args: [boolean]; return: void };
    [BackupChannels.getReminder]: { args: []; return: boolean };
    [BackupChannels.login]: { args: []; return: BackupStatus | null };

    // Sync
    [SyncChannels.getStatus]: { args: []; return: SyncStatus };

    // App
    [AppChannels.initialize]: { args: []; return: void };
    [AppChannels.getActiveLanguage]: { args: []; return: string };
    [AppChannels.setActiveLanguage]: { args: [string]; return: void };
    [AppChannels.restart]: { args: []; return: void };
    [AppChannels.getUpdateStatus]: { args: []; return: UpdaterNotification };
    [AppChannels.startDownloadUpdate]: { args: []; return: void };
    [AppChannels.quitAndInstallUpdate]: { args: []; return: void };
    [AppChannels.getSidebarStatus]: { args: []; return: SidebarStatus | null };
    [AppChannels.setSidebarStatus]: { args: [boolean]; return: void };
    [AppChannels.getCustomDocuments]: { args: []; return: CustomDocument[] };
    [AppChannels.deleteCustomDocument]: { args: [string]; return: void };
    [AppChannels.createCustomDocument]: { args: [string, Uint8Array]; return: CustomDocument };
    [AppChannels.getCustomDocumentContent]: {
        args: [string];
        return: CustomDocumentContent | null;
    };
    [AppChannels.getHistory]: { args: []; return: HistoryData[] };
    [AppChannels.getHistoryItems]: {
        args: [string];
        return: HistoryDataItem[];
    };
}

/** Maps each push channel to the payload type sent from main → renderer. */
export interface PushEventMap {
    [PushChannels.openModalDocumentFromMain]: void;
    [PushChannels.backupProgression]: RestoreProgressEvent;
    [PushChannels.backupAccessStatus]: boolean;
    [PushChannels.openBackupModalFromMain]: void;
    [PushChannels.appUpdateMenu]: void;
    [PushChannels.toggleSidebar]: void;
    [PushChannels.switchOnMenu]: void;
    [PushChannels.notifyForNewUpdate]: UpdaterNotification;
    [PushChannels.switchOnOptions]: void;
    [PushChannels.changeMenuViewer]: ViewMenuValue;
    [PushChannels.downloadAudioProgress]: AudioDownloadProgress;
    [PushChannels.newSynchronizedDatas]: string[];
    [PushChannels.openLanguageManager]: void;
    [PushChannels.languageDownloadProgress]: LanguageDownloadProgress;
    [PushChannels.languageInstalled]: { langCode: string };
    [PushChannels.bibleDownloadProgress]: { abbreviation: string; percentage: number };
    [PushChannels.bibleDownloaded]: { abbreviation: string };
}

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/** All invoke channel string values. */
export type InvokeChannel = keyof InvokeChannelMap;

/** All push channel string values. */
export type PushChannel = keyof PushEventMap;
