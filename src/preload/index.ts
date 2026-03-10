import { contextBridge, ipcRenderer, shell } from 'electron';
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
    PushChannels,
    type InvokeChannel,
    type InvokeChannelMap,
    type PushChannel,
    type PushEventMap,
} from '@shared/ipc.types';
import type {
    BibleBook,
    BookRequest,
    DocumentHtmlTree,
    DocumentTab,
    HighlightCreateData,
    HighlightUpdateData,
    ParagraphReference,
    SearchMode,
    SubjectRefTree,
} from '@shared/types';
import type {
    TtsProviderType,
    TtsSettings,
    TtsSynthesizeRequest,
    TtsSegment,
    TtsVoiceCloneRequest,
} from '@shared/tts.types';

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
            invoke(SearchChannels.searchText, langCode, query, page, mode ?? 'any'),
        searchContent: (langCode: string, query: string, translationId: number) =>
            invoke(SearchChannels.searchContent, langCode, query, translationId),
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
        updateReference: (
            id: string,
            ref: SubjectRefTree,
            documentTitle: string,
            sermonId: string,
        ) => invoke(NotesChannels.updateReference, id, ref, documentTitle, sermonId),
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
        delete: (id: string) => invoke(SubjectChannels.delete, id),
        getItems: (subjectId: string) => invoke(SubjectChannels.getItems, subjectId),
        deleteItem: (id: string) => invoke(SubjectChannels.deleteItem, id),
        createItem: (
            subjectId: string,
            docTitle: string,
            htmlTree: DocumentHtmlTree | ParagraphReference,
            text: string,
            bible?: BibleBook,
            sermonId?: string,
        ) =>
            invoke(
                SubjectChannels.createItem,
                subjectId,
                docTitle,
                htmlTree,
                text,
                bible,
                sermonId,
            ),
    },

    highlights: {
        getByDocument: (documentTitle: string, sermonId: string) =>
            invoke(HighlightChannels.getByDocument, documentTitle, sermonId),
        create: (data: HighlightCreateData) => invoke(HighlightChannels.create, data),
        update: (id: string, data: HighlightUpdateData) =>
            invoke(HighlightChannels.update, id, data),
        delete: (id: string) => invoke(HighlightChannels.delete, id),
    },

    audio: {
        getTimeAndLocalFile: (audioLink: string) =>
            invoke(AudioChannels.getTimeAndLocalFile, audioLink),
        setTime: (audioLink: string, time: number) =>
            invoke(AudioChannels.setTime, audioLink, time),
        getLastPlay: () => invoke(AudioChannels.getLastPlay),
        setLastPlay: (title: string) => invoke(AudioChannels.setLastPlay, title),
    },

    backup: {
        getStatus: () => invoke(BackupChannels.getStatus),
        toggleStatus: (active: boolean) => invoke(BackupChannels.toggleStatus, active),
        getReminder: () => invoke(BackupChannels.getReminder),
        login: () => invoke(BackupChannels.login),
    },

    sync: {
        getStatus: () => invoke(SyncChannels.getStatus),
        start: () => invoke(SyncChannels.start),
        stop: () => invoke(SyncChannels.stop),
        syncNow: () => invoke(SyncChannels.syncNow),
    },

    app: {
        initialize: () => invoke(AppChannels.initialize),
        getActiveLanguage: () => invoke(AppChannels.getActiveLanguage),
        setActiveLanguage: (langCode: string) => invoke(AppChannels.setActiveLanguage, langCode),
        restart: () => invoke(AppChannels.restart),
        getUpdateStatus: () => invoke(AppChannels.getUpdateStatus),
        startDownloadUpdate: () => invoke(AppChannels.startDownloadUpdate),
        quitAndInstallUpdate: () => invoke(AppChannels.quitAndInstallUpdate),
        checkForUpdates: () => invoke(AppChannels.checkForUpdates),
        getSidebarStatus: () => invoke(AppChannels.getSidebarStatus),
        setSidebarStatus: (hidden: boolean) => invoke(AppChannels.setSidebarStatus, hidden),
        getCustomDocuments: () => invoke(AppChannels.getCustomDocuments),
        deleteCustomDocument: (id: string) => invoke(AppChannels.deleteCustomDocument, id),
        createCustomDocument: (title: string, pdfBytes: Uint8Array) =>
            invoke(AppChannels.createCustomDocument, title, pdfBytes),
        getCustomDocumentContent: (id: string) => invoke(AppChannels.getCustomDocumentContent, id),
        getHistory: (langCode: string) => invoke(AppChannels.getHistory, langCode),
        addHistoryEntry: (langCode: string, documentTitle: string, sermonId: string) =>
            invoke(AppChannels.addHistoryEntry, langCode, documentTitle, sermonId),
        getHistoryItems: (historyId: string) => invoke(AppChannels.getHistoryItems, historyId),
        openExternal: (url: string) => shell.openExternal(url),
    },

    tts: {
        getProviders: () => invoke(TtsChannels.getProviders),
        getSettings: () => invoke(TtsChannels.getSettings),
        updateSettings: (s: Partial<TtsSettings>) => invoke(TtsChannels.updateSettings, s),
        synthesize: (req: TtsSynthesizeRequest) => invoke(TtsChannels.synthesize, req),
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
        getModelStatus: (p: TtsProviderType) => invoke(TtsChannels.getModelStatus, p),
        clearCache: () => invoke(TtsChannels.clearCache),
        getCacheSize: () => invoke(TtsChannels.getCacheSize),
        cloneVoice: (req: TtsVoiceCloneRequest) => invoke(TtsChannels.cloneVoice, req),
        listClonedVoices: () => invoke(TtsChannels.listClonedVoices),
        deleteClonedVoice: (id: string) => invoke(TtsChannels.deleteClonedVoice, id),
        getProviderModels: (p: TtsProviderType) => invoke(TtsChannels.getProviderModels, p),
        deleteProviderModel: (p: TtsProviderType, modelName: string) =>
            invoke(TtsChannels.deleteProviderModel, p, modelName),
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
        openLanguageManager: (
            cb: (p: PushEventMap[typeof PushChannels.openLanguageManager]) => void,
        ) => onPush(PushChannels.openLanguageManager, cb),
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
    },
} as const;

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
