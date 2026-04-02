import type {
    AudioDocumentPlayRequest,
    AvailableTranslation,
    DocumentReferenceSelection,
    HighlightCreateData,
} from '@shared/types';

export const EDITOR_EVENT = {
    renameNoteModal: 'rename-note-modal',
    renameNote: 'rename-note',
} as const;

export type RenameNoteDetail = {
    name: string;
};

export const CUSTOM_DOCUMENT_EVENT = {
    customDocumentRemoved: 'custom-document-removed',
    customDocumentAdded: 'custom-document-added',
    openModal: 'custom-document-open-modal',
} as const;

export const SUBJECT_EVENT = {
    focusSubject: 'focus-subject',
} as const;

export const CHILD_PARENT_WINDOW_EVENT = {
    addDocumentRefSubject: 'add-document-ref-subject',
    addDocumentRefNote: 'add-document-ref-note',
    openOtherTranslationsModal: 'open-other-translations-modal',
    audioDocumentPlay: 'audio-document-play',
    noSelectableDocumentText: 'no-selectable-document-text',
    openHighlightModal: 'open-highlight-modal',
    showSimilarSermons: 'show-similar-sermons',
} as const;

export const HIGHLIGHT_EVENT = {
    highlightsUpdated: 'highlights-updated',
} as const;

export const SYNC_EVENT = {
    syncCompleted: 'sync-completed',
    syncFailed: 'sync-failed',
} as const;

export const HISTORY_EVENT = {
    historyUpdated: 'history-updated',
} as const;

export const LANGUAGE_EVENT = {
    openLibrary: 'open-library',
    catalogChanged: 'language-catalog-changed',
} as const;

export const TTS_EVENT = {
    segmentComplete: 'tts-segment-complete',
    stateChanged: 'tts-state-changed',
} as const;

export const AI_DATA_EVENT = {
    notesChanged: 'ai-data-notes-changed',
    subjectsChanged: 'ai-data-subjects-changed',
    conversationsChanged: 'ai-data-conversations-changed',
} as const;

export const DOCUMENT_CONTAINER_ID = 'page-container';

export type OpenOtherTranslationsModalDetail = {
    tabKey: string;
    sermonId: string;
    title: string;
    availableTranslations: AvailableTranslation[];
};

export type AudioDocumentPlayDetail = AudioDocumentPlayRequest;

export type OpenHighlightModalDetail = Omit<HighlightCreateData, 'color' | 'comment'>;

export type AddDocumentReferenceDetail = DocumentReferenceSelection & {
    documentTitle: string;
};

export type FocusSubjectDetail = {
    id: string;
};

export type ShowSimilarSermonsDetail = {
    paragraphIndex: number;
    translationId: number;
    sermonDate: number;
    languageCode: string;
    textSnippet: string;
};
