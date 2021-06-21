import { mainMessageTransport } from './ipc/ipc-main';
import { IPC_EVENTS } from '../utils/ipc-events';
import title_documents from './handlers/title_documents';
import document_content_path from './handlers/document_content_path';
import document_tabs from './handlers/document_tabs';
import search_suggestions from './handlers/search_suggestions';
import search_text from './handlers/search_text';
import subject_document, {
  subject_document_delete,
} from './handlers/subject_document';
import subject_items, {
  subject_items_delete,
  subject_items_store,
} from './handlers/subject_items';
import custom_documents, {
  custom_documents_delete,
  custom_documents_store,
} from './handlers/custom_documents';
import history_item, { history_data_item } from './handlers/history_item';
import notes_items, {
  notes_items_delete,
  notes_items_get,
  notes_items_rename,
  notes_items_store,
  notes_items_update_content,
} from './handlers/notes_items';
import notes_references, {
  notes_references_get,
  notes_references_put,
  notes_references_store,
  notes_references_sync,
} from './handlers/notes_references';
import bible_indexes from './handlers/bible_indexes';
import bible_books from './handlers/bible_books';

mainMessageTransport(IPC_EVENTS.title_documents, title_documents);

mainMessageTransport(IPC_EVENTS.document_content_path, document_content_path);

mainMessageTransport(IPC_EVENTS.document_tabs, document_tabs);

// search_suggestions

mainMessageTransport(IPC_EVENTS.search_suggestions, search_suggestions);

mainMessageTransport(IPC_EVENTS.search_text, search_text);

// subject document

mainMessageTransport(IPC_EVENTS.subject_document, subject_document);

mainMessageTransport(
  IPC_EVENTS.subject_document_delete,
  subject_document_delete
);

// subject items
mainMessageTransport(IPC_EVENTS.subject_items, subject_items);

mainMessageTransport(IPC_EVENTS.subject_items_delete, subject_items_delete);

mainMessageTransport(IPC_EVENTS.subject_items_store, subject_items_store);

// custom documents
mainMessageTransport(IPC_EVENTS.custom_documents, custom_documents);

mainMessageTransport(
  IPC_EVENTS.custom_documents_delete,
  custom_documents_delete
);

mainMessageTransport(IPC_EVENTS.custom_documents_store, custom_documents_store);

// note history

mainMessageTransport(IPC_EVENTS.history_data, history_item);

mainMessageTransport(IPC_EVENTS.history_data_item, history_data_item);

// note items

mainMessageTransport(IPC_EVENTS.notes_items, notes_items);

mainMessageTransport(IPC_EVENTS.notes_items_delete, notes_items_delete);

mainMessageTransport(IPC_EVENTS.notes_items_store, notes_items_store);

mainMessageTransport(IPC_EVENTS.notes_items_rename, notes_items_rename);

mainMessageTransport(
  IPC_EVENTS.notes_items_update_content,
  notes_items_update_content
);

mainMessageTransport(IPC_EVENTS.notes_items_get, notes_items_get);

// note reference
mainMessageTransport(IPC_EVENTS.notes_references, notes_references);

mainMessageTransport(IPC_EVENTS.notes_references_store, notes_references_store);

mainMessageTransport(IPC_EVENTS.notes_references_get, notes_references_get);

mainMessageTransport(IPC_EVENTS.notes_references_sync, notes_references_sync);

mainMessageTransport(IPC_EVENTS.notes_references_put, notes_references_put);

// bible index
mainMessageTransport(IPC_EVENTS.bible_indexes, bible_indexes);

// bible books
mainMessageTransport(IPC_EVENTS.bible_books, bible_books);
