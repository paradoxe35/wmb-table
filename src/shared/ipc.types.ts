import type {
    DocumentTab,
    ReadingPosition,
    HighlightItem,
    HighlightSearchResult,
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
    DocumentPreview,
    DocumentReferenceSelection,
    CustomDocument,
    CustomDocumentContent,
    CustomDocumentImportInput,
    DocumentIdentity,
    HistoryData,
    HistoryDataItem,
    HistoryEntryCreateData,
    AudioTimeAndDownload,
    AudioDownloadProgress,
    AudioDocumentPlayRequest,
    SearchMode,
    BackupStatus,
    RestoreProgressEvent,
    UpdaterNotification,
    ViewMenuValue,
    DocumentReference,
    SermonListItemWithTranslations,
    SermonMeta,
    SermonContent,
    InstalledLanguage,
    DownloadableLanguage,
    TantivySearchResult,
    LanguageDownloadProgress,
    SyncStatus,
    SyncFailureEvent,
    HighlightCreateData,
    HighlightUpdateData,
    SermonTranslation,
    BibleDownloadProgress,
    BibleDownloadedEvent,
    BibleDownloadFailedEvent,
    LanguageInstalledEvent,
    LanguageInstallFailedEvent,
    SimilarSermonsResult,
} from './types';
import type {
    TtsProviderInfo,
    TtsProviderType,
    TtsSettings,
    TtsSynthesizeResult,
    TtsSegment,
    TtsPlaybackState,
    TtsModelDownloadProgress,
    TtsSegmentAudio,
    TtsVoice,
    TtsVoiceCloneRequest,
    TtsVoiceCloneResult,
    TtsReferenceVoiceAudio,
    TtsModelInfo,
    TtsCompatibilityResult,
} from './tts.types';
import type {
    AiConversation,
    AiConversationHistoryPage,
    AiConversationHistoryPageRequest,
    AiModelDownloadProgress,
    AiModelScanResult,
    AiRetryMessageRequest,
    AiRetryMessageResult,
    AiProviderTestResult,
    AiRemoteModel,
    AiProviderDefinition,
    AiMessageHistoryPage,
    AiMessageHistoryPageRequest,
    AiSendMessageRequest,
    AiSendMessageResult,
    AiSettings,
    AiStreamChunkEvent,
    AiStreamCancelEvent,
    AiStreamCompleteEvent,
    AiStreamErrorEvent,
    AiToolEvent,
    AiReasoningEvent,
    AiConversationUpdatedEvent,
} from './ai.types';
import type { UiLanguagePreference } from './constants';

// ---------------------------------------------------------------------------
// Invoke channels — renderer → main (request/response via ipcRenderer.invoke)
// ---------------------------------------------------------------------------

export type PdfExportResult =
    | { status: 'success'; filePath: string }
    | { status: 'canceled' | 'empty' };

export const DocumentChannels = {
    getTitles: 'documents:getTitles',
    getSermonContent: 'documents:getSermonContent',
    getSermonList: 'documents:getSermonList',
    getSermonsByYear: 'documents:getSermonsByYear',
    getTranslations: 'documents:getTranslations',
    getTranslationsForSermonInLanguage: 'documents:getTranslationsForSermonInLanguage',
    getTabs: 'documents:getTabs',
    saveTabs: 'documents:saveTabs',
    getReadingPosition: 'documents:getReadingPosition',
    saveReadingPosition: 'documents:saveReadingPosition',
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
    findSimilarSermons: 'search:findSimilarSermons',
} as const;

export const NotesChannels = {
    getAll: 'notes:getAll',
    getById: 'notes:getById',
    create: 'notes:create',
    delete: 'notes:delete',
    rename: 'notes:rename',
    importDocument: 'notes:importDocument',
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
    deleteReference: 'notes:deleteReference',
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
    rename: 'subjects:rename',
    delete: 'subjects:delete',
    getItems: 'subjects:getItems',
    reorderItems: 'subjects:reorderItems',
    deleteItem: 'subjects:deleteItem',
    createItem: 'subjects:createItem',
    exportPdf: 'subjects:exportPdf',
} as const;

export const HighlightChannels = {
    search: 'highlights:search',
    getByDocument: 'highlights:getByDocument',
    create: 'highlights:create',
    update: 'highlights:update',
    delete: 'highlights:delete',
    exportPdf: 'highlights:exportPdf',
} as const;

export const AudioChannels = {
    getTimeAndLocalFile: 'audio:getTimeAndLocalFile',
    setTime: 'audio:setTime',
    getLastPlay: 'audio:getLastPlay',
    setLastPlay: 'audio:setLastPlay',
    cacheAudio: 'audio:cacheAudio',
} as const;

export const BackupChannels = {
    getStatus: 'backup:getStatus',
    toggleStatus: 'backup:toggleStatus',
    getReminder: 'backup:getReminder',
    login: 'backup:login',
    logout: 'backup:logout',
} as const;

export const SyncChannels = {
    getStatus: 'sync:getStatus',
    start: 'sync:start',
    stop: 'sync:stop',
    syncNow: 'sync:syncNow',
} as const;

export const AppChannels = {
    isInitialized: 'app:isInitialized',
    initialize: 'app:initialize',
    getContentLanguage: 'app:getContentLanguage',
    setContentLanguage: 'app:setContentLanguage',
    getRememberReadingPosition: 'app:getRememberReadingPosition',
    setRememberReadingPosition: 'app:setRememberReadingPosition',
    getMaxTabs: 'app:getMaxTabs',
    setMaxTabs: 'app:setMaxTabs',
    openExternal: 'app:openExternal',
    restart: 'app:restart',
    getUpdateStatus: 'app:getUpdateStatus',
    startDownloadUpdate: 'app:startDownloadUpdate',
    quitAndInstallUpdate: 'app:quitAndInstallUpdate',
    checkForUpdates: 'app:checkForUpdates',
    getSidebarStatus: 'app:getSidebarStatus',
    setSidebarStatus: 'app:setSidebarStatus',
    getCustomDocuments: 'app:getCustomDocuments',
    deleteCustomDocument: 'app:deleteCustomDocument',
    createCustomDocument: 'app:createCustomDocument',
    getCustomDocumentContent: 'app:getCustomDocumentContent',
    updateCustomDocumentLanguage: 'app:updateCustomDocumentLanguage',
    getHistory: 'app:getHistory',
    addHistoryEntry: 'app:addHistoryEntry',
    getHistoryItems: 'app:getHistoryItems',
    getUiLanguage: 'app:getUiLanguage',
    setUiLanguage: 'app:setUiLanguage',
} as const;

export const TtsChannels = {
    getProviders: 'tts:getProviders',
    getSettings: 'tts:getSettings',
    updateSettings: 'tts:updateSettings',
    startPlayback: 'tts:startPlayback',
    pausePlayback: 'tts:pausePlayback',
    resumePlayback: 'tts:resumePlayback',
    stopPlayback: 'tts:stopPlayback',
    seekToSegment: 'tts:seekToSegment',
    segmentComplete: 'tts:segmentComplete',
    checkLanguageSupport: 'tts:checkLanguageSupport',
    downloadModel: 'tts:downloadModel',
    clearCache: 'tts:clearCache',
    getCacheSize: 'tts:getCacheSize',
    cloneVoice: 'tts:cloneVoice',
    listClonedVoices: 'tts:listClonedVoices',
    deleteClonedVoice: 'tts:deleteClonedVoice',
    getReferenceVoiceAudio: 'tts:getReferenceVoiceAudio',
    getProviderModels: 'tts:getProviderModels',
    deleteProviderModel: 'tts:deleteProviderModel',
    segmentParagraphs: 'tts:segmentParagraphs',
    previewVoice: 'tts:previewVoice',
    resolveConfigForLanguage: 'tts:resolveConfigForLanguage',
} as const;

export const AiChannels = {
    getSettings: 'ai:getSettings',
    getProviderCatalog: 'ai:getProviderCatalog',
    updateSettings: 'ai:updateSettings',
    getConversationsPage: 'ai:getConversationsPage',
    createConversation: 'ai:createConversation',
    renameConversation: 'ai:renameConversation',
    deleteConversation: 'ai:deleteConversation',
    exportConversationPdf: 'ai:exportConversationPdf',
    clearConversations: 'ai:clearConversations',
    getMessagesPage: 'ai:getMessagesPage',
    sendMessage: 'ai:sendMessage',
    retryMessage: 'ai:retryMessage',
    stopGeneration: 'ai:stopGeneration',
    scanLocalModels: 'ai:scanLocalModels',
    testProvider: 'ai:testProvider',
    downloadModel: 'ai:downloadModel',
    fetchProviderModels: 'ai:fetchProviderModels',
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
    syncFailure: 'push:syncFailure',
    openLibrary: 'push:openLibrary',
    languageDownloadProgress: 'push:languageDownloadProgress',
    languageInstalled: 'push:languageInstalled',
    languageInstallFailed: 'push:languageInstallFailed',
    bibleDownloadProgress: 'push:bibleDownloadProgress',
    bibleDownloaded: 'push:bibleDownloaded',
    bibleDownloadFailed: 'push:bibleDownloadFailed',
    openSettings: 'push:openSettings',
    ttsPlaybackState: 'push:ttsPlaybackState',
    ttsModelDownloadProgress: 'push:ttsModelDownloadProgress',
    ttsSegmentAudio: 'push:ttsSegmentAudio',
    aiStreamChunk: 'push:aiStreamChunk',
    aiStreamComplete: 'push:aiStreamComplete',
    aiStreamCancel: 'push:aiStreamCancel',
    aiStreamError: 'push:aiStreamError',
    aiToolCallStart: 'push:aiToolCallStart',
    aiToolCallComplete: 'push:aiToolCallComplete',
    aiModelDownloadProgress: 'push:aiModelDownloadProgress',
    aiReasoningDelta: 'push:aiReasoningDelta',
    aiConversationUpdated: 'push:aiConversationUpdated',
    toggleReadingMode: 'push:toggleReadingMode',
} as const;

// ---------------------------------------------------------------------------
// Type maps
// ---------------------------------------------------------------------------

/** Maps each invoke channel to its argument tuple and return type. */
export interface InvokeChannelMap {
    // Documents
    [DocumentChannels.getTitles]: { args: [string]; return: SermonListItemWithTranslations[] };
    [DocumentChannels.getSermonContent]: {
        args: [string, number, string];
        return: SermonContent;
    };
    [DocumentChannels.getSermonList]: { args: [string, { year?: string }?]; return: SermonMeta[] };
    [DocumentChannels.getSermonsByYear]: { args: [string]; return: Record<string, SermonMeta[]> };
    [DocumentChannels.getTranslations]: {
        args: [string];
        return: SermonTranslation[];
    };
    [DocumentChannels.getTranslationsForSermonInLanguage]: {
        args: [string, string];
        return: SermonMeta[];
    };
    [DocumentChannels.getTabs]: { args: [string]; return: DocumentTab[] };
    [DocumentChannels.saveTabs]: { args: [string, DocumentTab[]]; return: void };
    [DocumentChannels.getReadingPosition]: { args: [string]; return: ReadingPosition | null };
    [DocumentChannels.saveReadingPosition]: {
        args: [string, number, number?];
        return: ReadingPosition;
    };

    // Languages
    [LanguageChannels.getInstalled]: {
        args: [{ checkForUpdates?: boolean; force?: boolean; includeStats?: boolean }?];
        return: InstalledLanguage[];
    };
    [LanguageChannels.getAvailable]: { args: []; return: DownloadableLanguage[] };
    [LanguageChannels.install]: { args: [string]; return: void };
    [LanguageChannels.delete]: { args: [string]; return: void };

    // Search
    [SearchChannels.getSuggestions]: { args: [string]; return: Suggestions[] };
    [SearchChannels.addSuggestion]: { args: [string, number, string]; return: Suggestions };
    [SearchChannels.searchText]: {
        args: [string, string, number, SearchMode];
        return: TantivySearchResult;
    };
    [SearchChannels.searchContent]: {
        args: [string, string, number];
        return: string;
    };
    [SearchChannels.findSimilarSermons]: {
        args: [string, number, number, number, number?];
        return: SimilarSermonsResult;
    };

    // Notes
    [NotesChannels.getAll]: { args: []; return: NoteItem[] };
    [NotesChannels.getById]: { args: [string]; return: NoteItem | null };
    [NotesChannels.create]: { args: [string]; return: NoteItem };
    [NotesChannels.delete]: { args: [string]; return: void };
    [NotesChannels.rename]: { args: [string, string]; return: NoteItem };
    [NotesChannels.importDocument]: {
        args: [string, CustomDocumentImportInput];
        return: NoteItem;
    };
    [NotesChannels.updateContent]: { args: [string, string]; return: void };
    [NotesChannels.getReferences]: { args: [string]; return: NoteItemReference[] };
    [NotesChannels.createReference]: {
        args: [string, string];
        return: NoteItemReference;
    };
    [NotesChannels.getReference]: { args: [string]; return: NoteItemReference | null };
    [NotesChannels.syncReferences]: {
        args: [string, string[]];
        return: void;
    };
    [NotesChannels.updateReference]: {
        args: [string, DocumentReferenceSelection, string];
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
        args: [string, string[]];
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
    [NotesChannels.deleteReference]: { args: [string]; return: void };
    [NotesChannels.exportPdf]: { args: [string]; return: PdfExportResult };

    // Bible
    [BibleChannels.getIndexes]: { args: [string?]; return: BibleIndex };
    [BibleChannels.getBooks]: { args: [BookRequest]; return: BibleBook[] };
    [BibleChannels.search]: { args: [string, number, string?]; return: BibleSearchResult };
    [BibleChannels.getVersions]: { args: []; return: BibleVersionInfo[] };
    [BibleChannels.getAllVersions]: { args: []; return: BibleVersionInfo[] };
    [BibleChannels.getActiveVersion]: { args: []; return: BibleVersionInfo | null };
    [BibleChannels.switchVersion]: { args: [string]; return: void };
    [BibleChannels.downloadVersion]: { args: [string]; return: void };
    [BibleChannels.refreshIndex]: { args: []; return: BibleVersionInfo[] };

    // Subjects
    [SubjectChannels.getAll]: { args: []; return: SubjectDocument[] };
    [SubjectChannels.create]: { args: [string]; return: SubjectDocument };
    [SubjectChannels.rename]: { args: [string, string]; return: void };
    [SubjectChannels.delete]: { args: [string]; return: void };
    [SubjectChannels.getItems]: { args: [string]; return: SubjectDocumentItem[] };
    [SubjectChannels.reorderItems]: { args: [string, string[]]; return: void };
    [SubjectChannels.deleteItem]: { args: [string]; return: void };
    [SubjectChannels.createItem]: {
        args: [string, string, DocumentReference, string, DocumentPreview?];
        return: SubjectDocumentItem;
    };
    [SubjectChannels.exportPdf]: { args: [string]; return: PdfExportResult };

    // Highlights
    [HighlightChannels.search]: {
        args: [string, number, number?, string?];
        return: HighlightSearchResult;
    };
    [HighlightChannels.getByDocument]: {
        args: [DocumentIdentity];
        return: HighlightItem[];
    };
    [HighlightChannels.create]: {
        args: [HighlightCreateData];
        return: HighlightItem[];
    };
    [HighlightChannels.update]: {
        args: [string, HighlightUpdateData];
        return: HighlightItem | null;
    };
    [HighlightChannels.delete]: { args: [string]; return: void };
    [HighlightChannels.exportPdf]: { args: [string?]; return: PdfExportResult };

    // Audio
    [AudioChannels.getTimeAndLocalFile]: {
        args: [string];
        return: AudioTimeAndDownload;
    };
    [AudioChannels.setTime]: { args: [string, number]; return: void };
    [AudioChannels.getLastPlay]: { args: []; return: AudioDocumentPlayRequest | null };
    [AudioChannels.setLastPlay]: { args: [AudioDocumentPlayRequest]; return: void };
    [AudioChannels.cacheAudio]: { args: [string]; return: void };

    // Backup
    [BackupChannels.getStatus]: { args: []; return: BackupStatus | null };
    [BackupChannels.toggleStatus]: { args: [boolean]; return: void };
    [BackupChannels.getReminder]: { args: []; return: boolean };
    [BackupChannels.login]: { args: []; return: BackupStatus | null };
    [BackupChannels.logout]: { args: []; return: void };

    // Sync
    [SyncChannels.getStatus]: { args: []; return: SyncStatus };
    [SyncChannels.start]: { args: []; return: void };
    [SyncChannels.stop]: { args: []; return: void };
    [SyncChannels.syncNow]: { args: []; return: void };

    // App
    [AppChannels.isInitialized]: { args: []; return: boolean };
    [AppChannels.initialize]: { args: []; return: void };
    [AppChannels.getContentLanguage]: { args: []; return: string | null };
    [AppChannels.setContentLanguage]: { args: [string | null]; return: void };
    [AppChannels.getRememberReadingPosition]: { args: []; return: boolean };
    [AppChannels.setRememberReadingPosition]: { args: [boolean]; return: void };
    [AppChannels.getMaxTabs]: { args: []; return: number };
    [AppChannels.setMaxTabs]: { args: [number]; return: number };
    [AppChannels.openExternal]: { args: [string]; return: void };
    [AppChannels.restart]: { args: []; return: void };
    [AppChannels.getUpdateStatus]: { args: []; return: UpdaterNotification };
    [AppChannels.startDownloadUpdate]: { args: []; return: void };
    [AppChannels.quitAndInstallUpdate]: { args: []; return: void };
    [AppChannels.checkForUpdates]: { args: []; return: void };
    [AppChannels.getSidebarStatus]: { args: []; return: SidebarStatus | null };
    [AppChannels.setSidebarStatus]: { args: [boolean]; return: void };
    [AppChannels.getCustomDocuments]: { args: []; return: CustomDocument[] };
    [AppChannels.deleteCustomDocument]: { args: [string]; return: void };
    [AppChannels.createCustomDocument]: {
        args: [string, CustomDocumentImportInput, string];
        return: CustomDocument;
    };
    [AppChannels.getCustomDocumentContent]: {
        args: [string];
        return: CustomDocumentContent | null;
    };
    [AppChannels.updateCustomDocumentLanguage]: { args: [string, string]; return: void };
    [AppChannels.getHistory]: { args: [string]; return: HistoryData[] };
    [AppChannels.addHistoryEntry]: { args: [string, HistoryEntryCreateData]; return: void };
    [AppChannels.getHistoryItems]: {
        args: [string];
        return: HistoryDataItem[];
    };
    [AppChannels.getUiLanguage]: { args: []; return: UiLanguagePreference | null };
    [AppChannels.setUiLanguage]: { args: [UiLanguagePreference]; return: void };

    // TTS
    [TtsChannels.getProviders]: { args: []; return: TtsProviderInfo[] };
    [TtsChannels.getSettings]: { args: []; return: TtsSettings };
    [TtsChannels.updateSettings]: { args: [Partial<TtsSettings>]; return: TtsSettings };
    [TtsChannels.startPlayback]: {
        args: [TtsSegment[], string, number?];
        return: void;
    };
    [TtsChannels.pausePlayback]: { args: []; return: void };
    [TtsChannels.resumePlayback]: { args: []; return: void };
    [TtsChannels.stopPlayback]: { args: []; return: void };
    [TtsChannels.seekToSegment]: { args: [number]; return: void };
    [TtsChannels.segmentComplete]: { args: []; return: void };
    [TtsChannels.checkLanguageSupport]: {
        args: [string];
        return: Record<TtsProviderType, TtsCompatibilityResult>;
    };
    [TtsChannels.downloadModel]: { args: [TtsProviderType, string?]; return: void };
    [TtsChannels.clearCache]: { args: []; return: void };
    [TtsChannels.getCacheSize]: { args: []; return: number };
    [TtsChannels.cloneVoice]: {
        args: [TtsProviderType, TtsVoiceCloneRequest];
        return: TtsVoiceCloneResult;
    };
    [TtsChannels.listClonedVoices]: { args: [TtsProviderType]; return: TtsVoice[] };
    [TtsChannels.deleteClonedVoice]: { args: [TtsProviderType, string]; return: void };
    [TtsChannels.getReferenceVoiceAudio]: { args: [string]; return: TtsReferenceVoiceAudio };
    [TtsChannels.getProviderModels]: { args: [TtsProviderType]; return: TtsModelInfo[] };
    [TtsChannels.deleteProviderModel]: { args: [TtsProviderType, string]; return: void };
    [TtsChannels.segmentParagraphs]: {
        args: [{ paragraphIndex: number; content: string }[], string];
        return: TtsSegment[];
    };
    [TtsChannels.previewVoice]: { args: [string]; return: TtsSynthesizeResult };
    [TtsChannels.resolveConfigForLanguage]: { args: [string]; return: TtsSettings | null };

    // AI assistant
    [AiChannels.getSettings]: { args: []; return: AiSettings };
    [AiChannels.getProviderCatalog]: { args: []; return: AiProviderDefinition[] };
    [AiChannels.updateSettings]: { args: [Partial<AiSettings>]; return: AiSettings };
    [AiChannels.getConversationsPage]: {
        args: [AiConversationHistoryPageRequest];
        return: AiConversationHistoryPage;
    };
    [AiChannels.createConversation]: {
        args: [{ title?: string }?];
        return: AiConversation;
    };
    [AiChannels.renameConversation]: {
        args: [string, string];
        return: AiConversation;
    };
    [AiChannels.deleteConversation]: { args: [string]; return: void };
    [AiChannels.exportConversationPdf]: { args: [string]; return: PdfExportResult };
    [AiChannels.clearConversations]: { args: []; return: void };
    [AiChannels.getMessagesPage]: {
        args: [AiMessageHistoryPageRequest];
        return: AiMessageHistoryPage;
    };
    [AiChannels.sendMessage]: { args: [AiSendMessageRequest]; return: AiSendMessageResult };
    [AiChannels.retryMessage]: { args: [AiRetryMessageRequest]; return: AiRetryMessageResult };
    [AiChannels.stopGeneration]: { args: [string]; return: void };
    [AiChannels.scanLocalModels]: { args: []; return: AiModelScanResult };
    [AiChannels.testProvider]: {
        args: [{ providerId: string; model: string; apiKey?: string; baseUrl?: string }];
        return: AiProviderTestResult;
    };
    [AiChannels.downloadModel]: { args: [string]; return: void };
    [AiChannels.fetchProviderModels]: {
        args: [{ providerId: string; apiKey?: string; baseUrl?: string }];
        return: AiRemoteModel[];
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
    [PushChannels.syncFailure]: SyncFailureEvent;
    [PushChannels.openLibrary]: void;
    [PushChannels.languageDownloadProgress]: LanguageDownloadProgress;
    [PushChannels.languageInstalled]: LanguageInstalledEvent;
    [PushChannels.languageInstallFailed]: LanguageInstallFailedEvent;
    [PushChannels.bibleDownloadProgress]: BibleDownloadProgress;
    [PushChannels.bibleDownloaded]: BibleDownloadedEvent;
    [PushChannels.bibleDownloadFailed]: BibleDownloadFailedEvent;
    [PushChannels.openSettings]: void;
    [PushChannels.ttsPlaybackState]: TtsPlaybackState;
    [PushChannels.ttsModelDownloadProgress]: TtsModelDownloadProgress;
    [PushChannels.ttsSegmentAudio]: TtsSegmentAudio;
    [PushChannels.aiStreamChunk]: AiStreamChunkEvent;
    [PushChannels.aiStreamComplete]: AiStreamCompleteEvent;
    [PushChannels.aiStreamCancel]: AiStreamCancelEvent;
    [PushChannels.aiStreamError]: AiStreamErrorEvent;
    [PushChannels.aiToolCallStart]: AiToolEvent;
    [PushChannels.aiToolCallComplete]: AiToolEvent;
    [PushChannels.aiModelDownloadProgress]: AiModelDownloadProgress;
    [PushChannels.aiReasoningDelta]: AiReasoningEvent;
    [PushChannels.aiConversationUpdated]: AiConversationUpdatedEvent;
    [PushChannels.toggleReadingMode]: void;
}

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/** All invoke channel string values. */
export type InvokeChannel = keyof InvokeChannelMap;

/** All push channel string values. */
export type PushChannel = keyof PushEventMap;
