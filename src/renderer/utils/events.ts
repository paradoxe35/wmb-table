export const EDITOR_EVENT = {
    renameNoteModal: 'rename-note-modal',
    renameNote: 'rename-note',
} as const;

export const CUSTOM_DOCUMENT_EVENT = {
    customDocumentRemoved: 'custom-document-removed',
    customDocumentAdded: 'custom-document-added',
} as const;

export const SUBJECT_EVENT = {
    focusSubject: 'focus-subject',
} as const;

export const CHILD_PARENT_WINDOW_EVENT = {
    addDocumentRefSubject: 'add-document-ref-subject',
    addDocumentRefNote: 'add-document-ref-note',
    openOtherTraductionsModal: 'open-other-traductions-modal',
    audioDocumentPlay: 'audio-document-play',
    noSelectableDocumentText: 'no-selectable-document-text',
} as const;

export const LANGUAGE_EVENT = {
    openLanguageManager: 'open-language-manager',
} as const;

export const DOCUMENT_CONTAINER_ID = 'page-container';
