export const POST_MESSAGE_EVENT = {
  documentQuery: 'document-query',
  subjectItem: 'subject-item',
  windowPosition: 'window-position',
  documentZoom: 'document-zoom',
  documentTitleData: 'document-title-data',
  currentAudioDocumentPlay: 'current-audio-document-play',
  requestForPostMessage: 'request-for-post-message',
};

export const EDITOR_EVENT = {
  renameNoteModal: 'rename-note-modal',
  renameNote: 'rename-note',
};

export const CUSTOM_DOCUMENT_EVENT = {
  customDocumentRemoved: 'custom-document-removed',
  customDocumentAdded: 'custom-document-added',
};

export const SUBJECT_EVENT = {
  focusSubject: 'focus-subject',
};

export const PARENT_WINDOW_EVENT = {
  frameDocumentSearchStart: 'frame-document-search-start',
  frameDocumentSearchEnd: 'frame-document-search-end',
};

export const CHILD_WINDOW_EVENT = {
  resultConstructed: 'result-constructed',
  searchOpen: 'search-open',
  searchOpenPopup: 'search-open-popup',
  searchResult: 'search-result',
};

export const CHILD_PARENT_WINDOW_EVENT = {
  closeDocumentQuery: 'close-document-query',
  documentCurrentZoom: 'document-current-zoom',
  openSearchModal: 'open-search-modal',
  documentViewLoaded: 'document-view-loaded',
  addDocumentRefSubject: 'add-document-ref-subject',
  addDocumentRefNote: 'add-document-ref-note',
  openDocumentExternalLink: 'open-document-external-link',
  openOtherTraductionsModal: 'open-other-traductions-modal',
  downloadDocumentPdf: 'download-document-pdf',
  audioDocumentPlay: 'audio-document-play',
};

export const DOCUMENT_CONTAINER_ID = 'page-container';
export const DOCUMENT_CONTENT_ID = 'content';
