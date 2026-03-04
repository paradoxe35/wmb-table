import { contextBridge, ipcRenderer } from 'electron';
import {
  DocumentChannels,
  SearchChannels,
  NotesChannels,
  BibleChannels,
  SubjectChannels,
  AudioChannels,
  BackupChannels,
  AppChannels,
  PushChannels,
  type PushChannel,
  type PushEventMap,
} from '@shared/ipc.types';

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
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
    getTitles: () => invoke(DocumentChannels.getTitles),
    getContentPath: (title: string) => invoke(DocumentChannels.getContentPath, title),
    getTabs: () => invoke(DocumentChannels.getTabs),
    saveTabs: (tabs: unknown[]) => invoke(DocumentChannels.saveTabs, tabs),
  },

  search: {
    getSuggestions: () => invoke(SearchChannels.getSuggestions),
    addSuggestion: (text: string, found: number) =>
      invoke(SearchChannels.addSuggestion, text, found),
    searchText: (query: string, page: number) => invoke(SearchChannels.searchText, query, page),
    searchContent: (title: string, matches: unknown[]) =>
      invoke(SearchChannels.searchContent, title, matches),
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
    createReference: (noteId: string, docTitle: string, htmlTree: unknown, text: string) =>
      invoke(NotesChannels.createReference, noteId, docTitle, htmlTree, text),
    getReference: (id: string) => invoke(NotesChannels.getReference, id),
    syncReferences: (noteId: string, refs: unknown[]) =>
      invoke(NotesChannels.syncReferences, noteId, refs),
    updateReference: (id: string, ref: unknown) => invoke(NotesChannels.updateReference, id, ref),
    getBibleReferences: (noteId: string) => invoke(NotesChannels.getBibleReferences, noteId),
    createBibleReference: (noteId: string, label: string) =>
      invoke(NotesChannels.createBibleReference, noteId, label),
    syncBibleReferences: (id: string, refs: unknown) =>
      invoke(NotesChannels.syncBibleReferences, id, refs),
    addBibleVerse: (id: string, book: unknown) => invoke(NotesChannels.addBibleVerse, id, book),
    removeBibleVerse: (id: string, verseId: string) =>
      invoke(NotesChannels.removeBibleVerse, id, verseId),
    exportPdf: (noteId: string) => invoke(NotesChannels.exportPdf, noteId),
  },

  bible: {
    getIndexes: () => invoke(BibleChannels.getIndexes),
    getBooks: (request: unknown) => invoke(BibleChannels.getBooks, request),
    search: (query: string, page: number) => invoke(BibleChannels.search, query, page),
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
      htmlTree: unknown,
      text: string,
      bible?: unknown,
    ) => invoke(SubjectChannels.createItem, subjectId, docTitle, htmlTree, text, bible),
  },

  audio: {
    getTimeAndLocalFile: (audioLink: string) =>
      invoke(AudioChannels.getTimeAndLocalFile, audioLink),
    setTime: (audioLink: string, time: number) => invoke(AudioChannels.setTime, audioLink, time),
    getLastPlay: () => invoke(AudioChannels.getLastPlay),
    setLastPlay: (title: string) => invoke(AudioChannels.setLastPlay, title),
  },

  backup: {
    getStatus: () => invoke(BackupChannels.getStatus),
    toggleStatus: (active: boolean) => invoke(BackupChannels.toggleStatus, active),
    getReminder: () => invoke(BackupChannels.getReminder),
    login: () => invoke(BackupChannels.login),
  },

  app: {
    initialize: () => invoke(AppChannels.initialize),
    restart: () => invoke(AppChannels.restart),
    getUpdateStatus: () => invoke(AppChannels.getUpdateStatus),
    startDownloadUpdate: () => invoke(AppChannels.startDownloadUpdate),
    quitAndInstallUpdate: () => invoke(AppChannels.quitAndInstallUpdate),
    getAsset: (name: string) => invoke(AppChannels.getAsset, name),
    getSidebarStatus: () => invoke(AppChannels.getSidebarStatus),
    setSidebarStatus: (hidden: boolean) => invoke(AppChannels.setSidebarStatus, hidden),
    getCustomDocuments: () => invoke(AppChannels.getCustomDocuments),
    deleteCustomDocument: (id: string) => invoke(AppChannels.deleteCustomDocument, id),
    uploadCustomDocuments: (docs: unknown[]) => invoke(AppChannels.uploadCustomDocuments, docs),
    getHistory: () => invoke(AppChannels.getHistory),
    getHistoryItems: (historyId: string) => invoke(AppChannels.getHistoryItems, historyId),
    downloadDocumentPdf: (title: string) => invoke(AppChannels.downloadDocumentPdf, title),
  },

  on: {
    customDocumentUploadProgress: (cb: (p: unknown) => void) =>
      onPush(PushChannels.customDocumentUploadProgress, cb),
    customDocumentConnectionRequired: (cb: () => void) =>
      onPush(PushChannels.customDocumentConnectionRequired, cb as () => void),
    customDocumentUploadedFile: (cb: (doc: unknown) => void) =>
      onPush(PushChannels.customDocumentUploadedFile, cb),
    openModalDocumentFromMain: (cb: () => void) =>
      onPush(PushChannels.openModalDocumentFromMain, cb as () => void),
    backupProgression: (cb: (event: unknown) => void) => onPush(PushChannels.backupProgression, cb),
    backupAccessStatus: (cb: (status: boolean) => void) =>
      onPush(PushChannels.backupAccessStatus, cb),
    openBackupModalFromMain: (cb: () => void) =>
      onPush(PushChannels.openBackupModalFromMain, cb as () => void),
    appUpdateMenu: (cb: () => void) => onPush(PushChannels.appUpdateMenu, cb as () => void),
    toggleSidebar: (cb: () => void) => onPush(PushChannels.toggleSidebar, cb as () => void),
    switchOnMenu: (cb: () => void) => onPush(PushChannels.switchOnMenu, cb as () => void),
    notifyForNewUpdate: (cb: (notification: unknown) => void) =>
      onPush(PushChannels.notifyForNewUpdate, cb),
    switchOnOptions: (cb: () => void) => onPush(PushChannels.switchOnOptions, cb as () => void),
    changeMenuViewer: (cb: (value: string) => void) => onPush(PushChannels.changeMenuViewer, cb),
    downloadDocumentPdfProgress: (cb: (progress: number) => void) =>
      onPush(PushChannels.downloadDocumentPdfProgress, cb),
    downloadAudioProgress: (cb: (progress: unknown) => void) =>
      onPush(PushChannels.downloadAudioProgress, cb),
    newSynchronizedDatas: (cb: () => void) =>
      onPush(PushChannels.newSynchronizedDatas, cb as () => void),
  },
} as const;

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
