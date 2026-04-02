import { contextBridge, ipcRenderer } from 'electron';
import {
    DocumentChannels,
    SearchChannels,
    NotesChannels,
    BibleChannels,
    SubjectChannels,
    HighlightChannels,
    AudioChannels,
    BackupChannels,
    SyncChannels,
    AppChannels,
    LanguageChannels,
    TtsChannels,
    AiChannels,
    PushChannels,
    type InvokeChannel,
    type InvokeChannelMap,
    type PushChannel,
    type PushEventMap,
} from '@shared/ipc.types';
import { DEFAULT_SEARCH_MODE, type UiLanguagePreference } from '@shared/constants';
import type {
    BookRequest,
    DocumentIdentity,
    DocumentReference,
    DocumentTab,
    HistoryEntryCreateData,
    DocumentPreview,
    ReadingPosition,
    HighlightCreateData,
    HighlightUpdateData,
    SearchMode,
    DocumentReferenceSelection,
} from '@shared/types';
import type {
    TtsProviderType,
    TtsSettings,
    TtsSegment,
    TtsVoiceCloneRequest,
} from '@shared/tts.types';
import type { AiSendMessageRequest, AiSettings } from '@shared/ai.types';

function invoke<C extends InvokeChannel>(
    channel: C,
    ...args: InvokeChannelMap[C]['args']
): Promise<InvokeChannelMap[C]['return']> {
    return ipcRenderer.invoke(channel, ...args);
}

function onPush<C extends PushChannel>(
    channel: C,
    callback: (payload: PushEventMap[C]) => void,
): () => void {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
        callback(args[0] as PushEventMap[C]);
    };
    ipcRenderer.on(channel, listener);
    return () => {
        ipcRenderer.removeListener(channel, listener);
    };
}

const api = {
    documents: {
        getTitles: (langCode: string) => invoke(DocumentChannels.getTitles, langCode),
        getSermonContent: (langCode: string, translationId: number, sermonId: string) =>
            invoke(DocumentChannels.getSermonContent, langCode, translationId, sermonId),
        getSermonList: (langCode: string, options?: { year?: string }) =>
            invoke(DocumentChannels.getSermonList, langCode, options),
        getSermonsByYear: (langCode: string) => invoke(DocumentChannels.getSermonsByYear, langCode),
        getTranslations: (sermonId: string) => invoke(DocumentChannels.getTranslations, sermonId),
        getTraductionsForSermon: (sermonId: string, langCode: string) =>
            invoke(DocumentChannels.getTraductionsForSermon, sermonId, langCode),
        getTabs: (langCode: string) => invoke(DocumentChannels.getTabs, langCode),
        saveTabs: (langCode: string, tabs: DocumentTab[]) =>
            invoke(DocumentChannels.saveTabs, langCode, tabs),
        getReadingPosition: (documentKey: string): Promise<ReadingPosition | null> =>
            invoke(DocumentChannels.getReadingPosition, documentKey),
        saveReadingPosition: (documentKey: string, scrollY: number, scrollX?: number) =>
            invoke(DocumentChannels.saveReadingPosition, documentKey, scrollY, scrollX),
    },

    languages: {
        getInstalled: () => invoke(LanguageChannels.getInstalled),
        getAvailable: () => invoke(LanguageChannels.getAvailable),
        install: (langCode: string) => invoke(LanguageChannels.install, langCode),
        delete: (langCode: string) => invoke(LanguageChannels.delete, langCode),
    },

    search: {
        getSuggestions: (langCode: string) => invoke(SearchChannels.getSuggestions, langCode),
        addSuggestion: (text: string, found: number, langCode: string) =>
            invoke(SearchChannels.addSuggestion, text, found, langCode),
        searchText: (langCode: string, query: string, page: number, mode?: SearchMode) =>
            invoke(SearchChannels.searchText, langCode, query, page, mode ?? DEFAULT_SEARCH_MODE),
        searchContent: (langCode: string, query: string, translationId: number) =>
            invoke(SearchChannels.searchContent, langCode, query, translationId),
        findSimilarSermons: (
            langCode: string,
            translationId: number,
            sermonDate: number,
            paragraphIndex: number,
            limit?: number,
        ) =>
            invoke(
                SearchChannels.findSimilarSermons,
                langCode,
                translationId,
                sermonDate,
                paragraphIndex,
                limit,
            ),
    },

    notes: {
        getAll: () => invoke(NotesChannels.getAll),
        getById: (id: string) => invoke(NotesChannels.getById, id),
        create: (name: string) => invoke(NotesChannels.create, name),
        delete: (id: string) => invoke(NotesChannels.delete, id),
        rename: (id: string, name: string) => invoke(NotesChannels.rename, id, name),
        updateContent: (id: string, content: string) =>
            invoke(NotesChannels.updateContent, id, content),
        getReferences: (noteId: string) => invoke(NotesChannels.getReferences, noteId),
        createReference: (noteId: string, label: string) =>
            invoke(NotesChannels.createReference, noteId, label),
        getReference: (id: string) => invoke(NotesChannels.getReference, id),
        syncReferences: (noteId: string, refs: string[]) =>
            invoke(NotesChannels.syncReferences, noteId, refs),
        updateReference: (id: string, ref: DocumentReferenceSelection, documentTitle: string) =>
            invoke(NotesChannels.updateReference, id, ref, documentTitle),
        getBibleReference: (id: string) => invoke(NotesChannels.getBibleReference, id),
        getBibleReferences: (noteId: string) => invoke(NotesChannels.getBibleReferences, noteId),
        createBibleReference: (noteId: string, label: string) =>
            invoke(NotesChannels.createBibleReference, noteId, label),
        syncBibleReferences: (id: string, refs: string[]) =>
            invoke(NotesChannels.syncBibleReferences, id, refs),
        addBibleVerse: (id: string, verseId: string) =>
            invoke(NotesChannels.addBibleVerse, id, verseId),
        removeBibleVerse: (id: string, verseId: string) =>
            invoke(NotesChannels.removeBibleVerse, id, verseId),
        deleteReference: (id: string) => invoke(NotesChannels.deleteReference, id),
        exportPdf: (noteId: string) => invoke(NotesChannels.exportPdf, noteId),
    },

    bible: {
        getIndexes: () => invoke(BibleChannels.getIndexes),
        getBooks: (request: BookRequest) => invoke(BibleChannels.getBooks, request),
        search: (query: string, page: number, testament?: string) =>
            invoke(BibleChannels.search, query, page, testament),
        getVersions: () => invoke(BibleChannels.getVersions),
        getAllVersions: () => invoke(BibleChannels.getAllVersions),
        getActiveVersion: () => invoke(BibleChannels.getActiveVersion),
        switchVersion: (abbreviation: string) => invoke(BibleChannels.switchVersion, abbreviation),
        downloadVersion: (abbreviation: string) =>
            invoke(BibleChannels.downloadVersion, abbreviation),
        refreshIndex: () => invoke(BibleChannels.refreshIndex),
    },

    subjects: {
        getAll: () => invoke(SubjectChannels.getAll),
        create: (name: string) => invoke(SubjectChannels.create, name),
        rename: (id: string, newName: string) => invoke(SubjectChannels.rename, id, newName),
        delete: (id: string) => invoke(SubjectChannels.delete, id),
        getItems: (subjectId: string) => invoke(SubjectChannels.getItems, subjectId),
        deleteItem: (id: string) => invoke(SubjectChannels.deleteItem, id),
        createItem: (
            subjectId: string,
            docTitle: string,
            documentReference: DocumentReference,
            text: string,
            documentPreview?: DocumentPreview,
        ) =>
            invoke(
                SubjectChannels.createItem,
                subjectId,
                docTitle,
                documentReference,
                text,
                documentPreview,
            ),
        exportPdf: (subjectId: string) => invoke(SubjectChannels.exportPdf, subjectId),
    },

    highlights: {
        search: (query: string, page: number, pageSize?: number, languageCode?: string) =>
            invoke(HighlightChannels.search, query, page, pageSize, languageCode),
        getByDocument: (documentTitle: string, documentIdentity: DocumentIdentity) =>
            invoke(HighlightChannels.getByDocument, documentTitle, documentIdentity),
        create: (data: HighlightCreateData) => invoke(HighlightChannels.create, data),
        update: (id: string, data: HighlightUpdateData) =>
            invoke(HighlightChannels.update, id, data),
        delete: (id: string) => invoke(HighlightChannels.delete, id),
        exportPdf: (languageCode?: string) => invoke(HighlightChannels.exportPdf, languageCode),
    },

    audio: {
        getTimeAndLocalFile: (audioLink: string) =>
            invoke(AudioChannels.getTimeAndLocalFile, audioLink),
        setTime: (audioLink: string, time: number) =>
            invoke(AudioChannels.setTime, audioLink, time),
        getLastPlay: () => invoke(AudioChannels.getLastPlay),
        setLastPlay: (title: string) => invoke(AudioChannels.setLastPlay, title),
        cacheAudio: (audioLink: string) => invoke(AudioChannels.cacheAudio, audioLink),
    },

    backup: {
        getStatus: () => invoke(BackupChannels.getStatus),
        toggleStatus: (active: boolean) => invoke(BackupChannels.toggleStatus, active),
        getReminder: () => invoke(BackupChannels.getReminder),
        login: () => invoke(BackupChannels.login),
        logout: () => invoke(BackupChannels.logout),
    },

    sync: {
        getStatus: () => invoke(SyncChannels.getStatus),
        start: () => invoke(SyncChannels.start),
        stop: () => invoke(SyncChannels.stop),
        syncNow: () => invoke(SyncChannels.syncNow),
    },

    app: {
        isInitialized: () => invoke(AppChannels.isInitialized),
        initialize: () => invoke(AppChannels.initialize),
        getContentLanguage: () => invoke(AppChannels.getContentLanguage),
        setContentLanguage: (langCode: string) => invoke(AppChannels.setContentLanguage, langCode),
        getRememberReadingPosition: () => invoke(AppChannels.getRememberReadingPosition),
        setRememberReadingPosition: (value: boolean) =>
            invoke(AppChannels.setRememberReadingPosition, value),
        getMaxTabs: () => invoke(AppChannels.getMaxTabs),
        setMaxTabs: (value: number) => invoke(AppChannels.setMaxTabs, value),
        restart: () => invoke(AppChannels.restart),
        getUpdateStatus: () => invoke(AppChannels.getUpdateStatus),
        startDownloadUpdate: () => invoke(AppChannels.startDownloadUpdate),
        quitAndInstallUpdate: () => invoke(AppChannels.quitAndInstallUpdate),
        checkForUpdates: () => invoke(AppChannels.checkForUpdates),
        getSidebarStatus: () => invoke(AppChannels.getSidebarStatus),
        setSidebarStatus: (hidden: boolean) => invoke(AppChannels.setSidebarStatus, hidden),
        getCustomDocuments: () => invoke(AppChannels.getCustomDocuments),
        deleteCustomDocument: (id: string) => invoke(AppChannels.deleteCustomDocument, id),
        createCustomDocument: (title: string, pdfBytes: Uint8Array, languageCode: string) =>
            invoke(AppChannels.createCustomDocument, title, pdfBytes, languageCode),
        getCustomDocumentContent: (id: string) => invoke(AppChannels.getCustomDocumentContent, id),
        updateCustomDocumentLanguage: (id: string, languageCode: string) =>
            invoke(AppChannels.updateCustomDocumentLanguage, id, languageCode),
        getHistory: (langCode: string) => invoke(AppChannels.getHistory, langCode),
        addHistoryEntry: (langCode: string, entry: HistoryEntryCreateData) =>
            invoke(AppChannels.addHistoryEntry, langCode, entry),
        getHistoryItems: (historyId: string) => invoke(AppChannels.getHistoryItems, historyId),
        getUiLanguage: () => invoke(AppChannels.getUiLanguage),
        setUiLanguage: (pref: UiLanguagePreference) => invoke(AppChannels.setUiLanguage, pref),
        openExternal: (url: string) => invoke(AppChannels.openExternal, url),
    },

    tts: {
        getProviders: () => invoke(TtsChannels.getProviders),
        getSettings: () => invoke(TtsChannels.getSettings),
        updateSettings: (s: Partial<TtsSettings>) => invoke(TtsChannels.updateSettings, s),
        startPlayback: (segs: TtsSegment[], lang: string, startIndex?: number) =>
            invoke(TtsChannels.startPlayback, segs, lang, startIndex),
        pausePlayback: () => invoke(TtsChannels.pausePlayback),
        resumePlayback: () => invoke(TtsChannels.resumePlayback),
        stopPlayback: () => invoke(TtsChannels.stopPlayback),
        seekToSegment: (i: number) => invoke(TtsChannels.seekToSegment, i),
        segmentComplete: () => invoke(TtsChannels.segmentComplete),
        checkLanguageSupport: (lang: string) => invoke(TtsChannels.checkLanguageSupport, lang),
        downloadModel: (p: TtsProviderType, modelName?: string) =>
            invoke(TtsChannels.downloadModel, p, modelName),
        clearCache: () => invoke(TtsChannels.clearCache),
        getCacheSize: () => invoke(TtsChannels.getCacheSize),
        cloneVoice: (provider: TtsProviderType, req: TtsVoiceCloneRequest) =>
            invoke(TtsChannels.cloneVoice, provider, req),
        listClonedVoices: (provider: TtsProviderType) =>
            invoke(TtsChannels.listClonedVoices, provider),
        deleteClonedVoice: (provider: TtsProviderType, id: string) =>
            invoke(TtsChannels.deleteClonedVoice, provider, id),
        getReferenceVoiceAudio: (referenceId: string) =>
            invoke(TtsChannels.getReferenceVoiceAudio, referenceId),
        getProviderModels: (p: TtsProviderType) => invoke(TtsChannels.getProviderModels, p),
        deleteProviderModel: (p: TtsProviderType, modelName: string) =>
            invoke(TtsChannels.deleteProviderModel, p, modelName),
        segmentParagraphs: (
            paragraphs: { paragraphIndex: number; content: string }[],
            language: string,
        ) => invoke(TtsChannels.segmentParagraphs, paragraphs, language),
        previewVoice: (language: string) => invoke(TtsChannels.previewVoice, language),
        resolveConfigForLanguage: (language: string) =>
            invoke(TtsChannels.resolveConfigForLanguage, language),
    },

    ai: {
        getSettings: () => invoke(AiChannels.getSettings),
        getProviderCatalog: () => invoke(AiChannels.getProviderCatalog),
        updateSettings: (settings: Partial<AiSettings>) =>
            invoke(AiChannels.updateSettings, settings),
        getConversations: () => invoke(AiChannels.getConversations),
        createConversation: (input?: { title?: string; languageCode?: string }) =>
            invoke(AiChannels.createConversation, input),
        deleteConversation: (conversationId: string) =>
            invoke(AiChannels.deleteConversation, conversationId),
        clearConversations: () => invoke(AiChannels.clearConversations),
        getMessages: (conversationId: string) => invoke(AiChannels.getMessages, conversationId),
        sendMessage: (request: AiSendMessageRequest) => invoke(AiChannels.sendMessage, request),
        stopGeneration: (conversationId: string) =>
            invoke(AiChannels.stopGeneration, conversationId),
        scanLocalModels: () => invoke(AiChannels.scanLocalModels),
        testProvider: (input: {
            providerId: string;
            model: string;
            apiKey?: string;
            baseUrl?: string;
        }) => invoke(AiChannels.testProvider, input),
        downloadModel: (modelId: string) => invoke(AiChannels.downloadModel, modelId),
        fetchProviderModels: (input: { providerId: string; apiKey?: string; baseUrl?: string }) =>
            invoke(AiChannels.fetchProviderModels, input),
    },

    on: {
        openModalDocumentFromMain: (
            cb: (p: PushEventMap[typeof PushChannels.openModalDocumentFromMain]) => void,
        ) => onPush(PushChannels.openModalDocumentFromMain, cb),
        backupProgression: (cb: (p: PushEventMap[typeof PushChannels.backupProgression]) => void) =>
            onPush(PushChannels.backupProgression, cb),
        backupAccessStatus: (
            cb: (p: PushEventMap[typeof PushChannels.backupAccessStatus]) => void,
        ) => onPush(PushChannels.backupAccessStatus, cb),
        openBackupModalFromMain: (
            cb: (p: PushEventMap[typeof PushChannels.openBackupModalFromMain]) => void,
        ) => onPush(PushChannels.openBackupModalFromMain, cb),
        appUpdateMenu: (cb: (p: PushEventMap[typeof PushChannels.appUpdateMenu]) => void) =>
            onPush(PushChannels.appUpdateMenu, cb),
        toggleSidebar: (cb: (p: PushEventMap[typeof PushChannels.toggleSidebar]) => void) =>
            onPush(PushChannels.toggleSidebar, cb),
        switchOnMenu: (cb: (p: PushEventMap[typeof PushChannels.switchOnMenu]) => void) =>
            onPush(PushChannels.switchOnMenu, cb),
        notifyForNewUpdate: (
            cb: (p: PushEventMap[typeof PushChannels.notifyForNewUpdate]) => void,
        ) => onPush(PushChannels.notifyForNewUpdate, cb),
        switchOnOptions: (cb: (p: PushEventMap[typeof PushChannels.switchOnOptions]) => void) =>
            onPush(PushChannels.switchOnOptions, cb),
        changeMenuViewer: (cb: (p: PushEventMap[typeof PushChannels.changeMenuViewer]) => void) =>
            onPush(PushChannels.changeMenuViewer, cb),
        downloadAudioProgress: (
            cb: (p: PushEventMap[typeof PushChannels.downloadAudioProgress]) => void,
        ) => onPush(PushChannels.downloadAudioProgress, cb),
        newSynchronizedDatas: (
            cb: (p: PushEventMap[typeof PushChannels.newSynchronizedDatas]) => void,
        ) => onPush(PushChannels.newSynchronizedDatas, cb),
        syncFailure: (cb: (p: PushEventMap[typeof PushChannels.syncFailure]) => void) =>
            onPush(PushChannels.syncFailure, cb),
        openLibrary: (cb: (p: PushEventMap[typeof PushChannels.openLibrary]) => void) =>
            onPush(PushChannels.openLibrary, cb),
        languageDownloadProgress: (
            cb: (p: PushEventMap[typeof PushChannels.languageDownloadProgress]) => void,
        ) => onPush(PushChannels.languageDownloadProgress, cb),
        languageInstalled: (cb: (p: PushEventMap[typeof PushChannels.languageInstalled]) => void) =>
            onPush(PushChannels.languageInstalled, cb),
        bibleDownloadProgress: (
            cb: (p: PushEventMap[typeof PushChannels.bibleDownloadProgress]) => void,
        ) => onPush(PushChannels.bibleDownloadProgress, cb),
        bibleDownloaded: (cb: (p: PushEventMap[typeof PushChannels.bibleDownloaded]) => void) =>
            onPush(PushChannels.bibleDownloaded, cb),
        openSettings: (cb: (p: PushEventMap[typeof PushChannels.openSettings]) => void) =>
            onPush(PushChannels.openSettings, cb),
        ttsPlaybackState: (cb: (p: PushEventMap[typeof PushChannels.ttsPlaybackState]) => void) =>
            onPush(PushChannels.ttsPlaybackState, cb),
        ttsModelDownloadProgress: (
            cb: (p: PushEventMap[typeof PushChannels.ttsModelDownloadProgress]) => void,
        ) => onPush(PushChannels.ttsModelDownloadProgress, cb),
        ttsSegmentAudio: (cb: (p: PushEventMap[typeof PushChannels.ttsSegmentAudio]) => void) =>
            onPush(PushChannels.ttsSegmentAudio, cb),
        aiStreamChunk: (cb: (p: PushEventMap[typeof PushChannels.aiStreamChunk]) => void) =>
            onPush(PushChannels.aiStreamChunk, cb),
        aiStreamComplete: (cb: (p: PushEventMap[typeof PushChannels.aiStreamComplete]) => void) =>
            onPush(PushChannels.aiStreamComplete, cb),
        aiStreamError: (cb: (p: PushEventMap[typeof PushChannels.aiStreamError]) => void) =>
            onPush(PushChannels.aiStreamError, cb),
        aiToolCallStart: (cb: (p: PushEventMap[typeof PushChannels.aiToolCallStart]) => void) =>
            onPush(PushChannels.aiToolCallStart, cb),
        aiToolCallComplete: (
            cb: (p: PushEventMap[typeof PushChannels.aiToolCallComplete]) => void,
        ) => onPush(PushChannels.aiToolCallComplete, cb),
        aiModelDownloadProgress: (
            cb: (p: PushEventMap[typeof PushChannels.aiModelDownloadProgress]) => void,
        ) => onPush(PushChannels.aiModelDownloadProgress, cb),
        aiReasoningDelta: (cb: (p: PushEventMap[typeof PushChannels.aiReasoningDelta]) => void) =>
            onPush(PushChannels.aiReasoningDelta, cb),
        aiConversationUpdated: (
            cb: (p: PushEventMap[typeof PushChannels.aiConversationUpdated]) => void,
        ) => onPush(PushChannels.aiConversationUpdated, cb),
        toggleReadingMode: (cb: (p: PushEventMap[typeof PushChannels.toggleReadingMode]) => void) =>
            onPush(PushChannels.toggleReadingMode, cb),
    },
} as const;

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
