import type {
    DataDocument,
    DocumentTab,
    Suggestions,
    SidebarStatus,
    SearchResult,
    SearchMatchersValue,
    NoteItem,
    NoteItemReference,
    NoteItemReferenceBible,
    BibleIndex,
    BibleBook,
    BookRequest,
    BibleSearchResult,
    SubjectDocument,
    SubjectDocumentItem,
    SubjectRefTree,
    CustomDocument,
    UploadDocument,
    HistoryData,
    HistoryDataItem,
    AudioDocumentTime,
    AudioDocumentDownload,
    AudioDownloadProgress,
    BackupStatus,
    RestoreProgressEvent,
    CustomDocumentUploadProgress,
    UpdaterNotification,
    ViewMenuValue,
    DocumentHtmlTree,
    SermonMeta,
} from './types';

// ---------------------------------------------------------------------------
// Invoke channels — renderer → main (request/response via ipcRenderer.invoke)
// ---------------------------------------------------------------------------

export const DocumentChannels = {
    getTitles: 'documents:getTitles',
    getContentPath: 'documents:getContentPath',
    getTabs: 'documents:getTabs',
    saveTabs: 'documents:saveTabs',
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

export const AppChannels = {
    initialize: 'app:initialize',
    restart: 'app:restart',
    getUpdateStatus: 'app:getUpdateStatus',
    startDownloadUpdate: 'app:startDownloadUpdate',
    quitAndInstallUpdate: 'app:quitAndInstallUpdate',
    getAsset: 'app:getAsset',
    getSidebarStatus: 'app:getSidebarStatus',
    setSidebarStatus: 'app:setSidebarStatus',
    getCustomDocuments: 'app:getCustomDocuments',
    deleteCustomDocument: 'app:deleteCustomDocument',
    uploadCustomDocuments: 'app:uploadCustomDocuments',
    getHistory: 'app:getHistory',
    getHistoryItems: 'app:getHistoryItems',
    downloadDocumentPdf: 'app:downloadDocumentPdf',
} as const;

// ---------------------------------------------------------------------------
// Push channels — main → renderer (one-way events via webContents.send)
// ---------------------------------------------------------------------------

export const PushChannels = {
    customDocumentUploadProgress: 'push:customDocumentUploadProgress',
    customDocumentConnectionRequired: 'push:customDocumentConnectionRequired',
    customDocumentUploadedFile: 'push:customDocumentUploadedFile',
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
    downloadDocumentPdfProgress: 'push:downloadDocumentPdfProgress',
    downloadAudioProgress: 'push:downloadAudioProgress',
    newSynchronizedDatas: 'push:newSynchronizedDatas',
} as const;

// ---------------------------------------------------------------------------
// Type maps
// ---------------------------------------------------------------------------

/** Maps each invoke channel to its argument tuple and return type. */
export interface InvokeChannelMap {
    // Documents
    [DocumentChannels.getTitles]: { args: []; return: SermonMeta[] };
    [DocumentChannels.getContentPath]: { args: [string]; return: DataDocument | null };
    [DocumentChannels.getTabs]: { args: []; return: DocumentTab[] };
    [DocumentChannels.saveTabs]: { args: [DocumentTab[]]; return: void };

    // Search
    [SearchChannels.getSuggestions]: { args: []; return: Suggestions[] };
    [SearchChannels.addSuggestion]: { args: [string, number]; return: Suggestions };
    [SearchChannels.searchText]: { args: [string, number]; return: SearchResult };
    [SearchChannels.searchContent]: {
        args: [string, SearchMatchersValue[]];
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
        args: [string, string, DocumentHtmlTree, string];
        return: NoteItemReference;
    };
    [NotesChannels.getReference]: { args: [string]; return: NoteItemReference | null };
    [NotesChannels.syncReferences]: {
        args: [string, SubjectRefTree[]];
        return: void;
    };
    [NotesChannels.updateReference]: {
        args: [string, SubjectRefTree];
        return: void;
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
        args: [string, BibleBook];
        return: void;
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

    // Subjects
    [SubjectChannels.getAll]: { args: []; return: SubjectDocument[] };
    [SubjectChannels.create]: { args: [string]; return: SubjectDocument };
    [SubjectChannels.delete]: { args: [string]; return: void };
    [SubjectChannels.getItems]: { args: [string]; return: SubjectDocumentItem[] };
    [SubjectChannels.deleteItem]: { args: [string]; return: void };
    [SubjectChannels.createItem]: {
        args: [string, string, DocumentHtmlTree, string, BibleBook?];
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
    [BackupChannels.login]: { args: []; return: void };

    // App
    [AppChannels.initialize]: { args: []; return: void };
    [AppChannels.restart]: { args: []; return: void };
    [AppChannels.getUpdateStatus]: { args: []; return: UpdaterNotification };
    [AppChannels.startDownloadUpdate]: { args: []; return: void };
    [AppChannels.quitAndInstallUpdate]: { args: []; return: void };
    [AppChannels.getAsset]: { args: [string]; return: string };
    [AppChannels.getSidebarStatus]: { args: []; return: SidebarStatus | null };
    [AppChannels.setSidebarStatus]: { args: [boolean]; return: void };
    [AppChannels.getCustomDocuments]: { args: []; return: CustomDocument[] };
    [AppChannels.deleteCustomDocument]: { args: [string]; return: void };
    [AppChannels.uploadCustomDocuments]: { args: [UploadDocument[]]; return: void };
    [AppChannels.getHistory]: { args: []; return: HistoryData[] };
    [AppChannels.getHistoryItems]: {
        args: [string];
        return: HistoryDataItem[];
    };
    [AppChannels.downloadDocumentPdf]: { args: [string]; return: void };
}

/** Maps each push channel to the payload type sent from main → renderer. */
export interface PushEventMap {
    [PushChannels.customDocumentUploadProgress]: CustomDocumentUploadProgress;
    [PushChannels.customDocumentConnectionRequired]: void;
    [PushChannels.customDocumentUploadedFile]: CustomDocument;
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
    [PushChannels.downloadDocumentPdfProgress]: number;
    [PushChannels.downloadAudioProgress]: AudioDownloadProgress;
    [PushChannels.newSynchronizedDatas]: void;
}

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/** All invoke channel string values. */
export type InvokeChannel = keyof InvokeChannelMap;

/** All push channel string values. */
export type PushChannel = keyof PushEventMap;
