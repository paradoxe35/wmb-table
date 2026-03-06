import { contextBridge, ipcRenderer, shell } from 'electron';
import {
    DocumentChannels,
    SearchChannels,
    NotesChannels,
    BibleChannels,
    SubjectChannels,
    AudioChannels,
    BackupChannels,
    SyncChannels,
    AppChannels,
    LanguageChannels,
    PushChannels,
    type InvokeChannel,
    type InvokeChannelMap,
    type PushChannel,
    type PushEventMap,
} from '@shared/ipc.types';
import type {
    AudioDownloadProgress,
    BibleBook,
    BookRequest,
    DocumentHtmlTree,
    DocumentTab,
    LanguageDownloadProgress,
    ParagraphReference,
    RestoreProgressEvent,
    SubjectRefTree,
    UpdaterNotification,
    ViewMenuValue,
} from '@shared/types';

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
        searchText: (langCode: string, query: string, page: number) =>
            invoke(SearchChannels.searchText, langCode, query, page),
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
        syncBibleReferences: (id: string, refs: BibleBook[] | string[]) =>
            invoke(NotesChannels.syncBibleReferences, id, refs),
        addBibleVerse: (id: string, verseId: string) =>
            invoke(NotesChannels.addBibleVerse, id, verseId),
        removeBibleVerse: (id: string, verseId: string) =>
            invoke(NotesChannels.removeBibleVerse, id, verseId),
        exportPdf: (noteId: string) => invoke(NotesChannels.exportPdf, noteId),
    },

    bible: {
        getIndexes: () => invoke(BibleChannels.getIndexes),
        getBooks: (request: BookRequest) => invoke(BibleChannels.getBooks, request),
        search: (query: string, page: number) => invoke(BibleChannels.search, query, page),
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
    },

    app: {
        initialize: () => invoke(AppChannels.initialize),
        getActiveLanguage: () => invoke(AppChannels.getActiveLanguage),
        setActiveLanguage: (langCode: string) => invoke(AppChannels.setActiveLanguage, langCode),
        restart: () => invoke(AppChannels.restart),
        getUpdateStatus: () => invoke(AppChannels.getUpdateStatus),
        startDownloadUpdate: () => invoke(AppChannels.startDownloadUpdate),
        quitAndInstallUpdate: () => invoke(AppChannels.quitAndInstallUpdate),
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

    on: {
        openModalDocumentFromMain: (cb: () => void) =>
            onPush(PushChannels.openModalDocumentFromMain, cb as () => void),
        backupProgression: (cb: (event: RestoreProgressEvent) => void) =>
            onPush(PushChannels.backupProgression, cb),
        backupAccessStatus: (cb: (status: boolean) => void) =>
            onPush(PushChannels.backupAccessStatus, cb),
        openBackupModalFromMain: (cb: () => void) =>
            onPush(PushChannels.openBackupModalFromMain, cb as () => void),
        appUpdateMenu: (cb: () => void) => onPush(PushChannels.appUpdateMenu, cb as () => void),
        toggleSidebar: (cb: () => void) => onPush(PushChannels.toggleSidebar, cb as () => void),
        switchOnMenu: (cb: () => void) => onPush(PushChannels.switchOnMenu, cb as () => void),
        notifyForNewUpdate: (cb: (notification: UpdaterNotification) => void) =>
            onPush(PushChannels.notifyForNewUpdate, cb),
        switchOnOptions: (cb: () => void) => onPush(PushChannels.switchOnOptions, cb as () => void),
        changeMenuViewer: (cb: (value: ViewMenuValue) => void) =>
            onPush(PushChannels.changeMenuViewer, cb),
        downloadAudioProgress: (cb: (progress: AudioDownloadProgress) => void) =>
            onPush(PushChannels.downloadAudioProgress, cb),
        newSynchronizedDatas: (cb: (tables: string[]) => void) =>
            onPush(PushChannels.newSynchronizedDatas, cb),
        openLanguageManager: (cb: () => void) =>
            onPush(PushChannels.openLanguageManager, cb as () => void),
        languageDownloadProgress: (cb: (p: LanguageDownloadProgress) => void) =>
            onPush(PushChannels.languageDownloadProgress, cb),
        languageInstalled: (cb: (p: { langCode: string }) => void) =>
            onPush(PushChannels.languageInstalled, cb),
        bibleDownloadProgress: (cb: (p: { abbreviation: string; percentage: number }) => void) =>
            onPush(PushChannels.bibleDownloadProgress, cb),
        bibleDownloaded: (cb: (p: { abbreviation: string }) => void) =>
            onPush(PushChannels.bibleDownloaded, cb),
    },
} as const;

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
