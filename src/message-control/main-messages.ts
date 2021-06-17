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

mainMessageTransport(IPC_EVENTS.title_documents, title_documents);

mainMessageTransport(IPC_EVENTS.document_content_path, document_content_path);

mainMessageTransport(IPC_EVENTS.document_tabs, document_tabs);

mainMessageTransport(IPC_EVENTS.search_suggestions, search_suggestions);

mainMessageTransport(IPC_EVENTS.search_text, search_text);

mainMessageTransport(IPC_EVENTS.subject_document, subject_document);

mainMessageTransport(
  IPC_EVENTS.subject_document_delete,
  subject_document_delete
);

mainMessageTransport(IPC_EVENTS.subject_items, subject_items);

mainMessageTransport(IPC_EVENTS.subject_items_delete, subject_items_delete);

mainMessageTransport(IPC_EVENTS.subject_items_store, subject_items_store);

mainMessageTransport(IPC_EVENTS.custom_documents, custom_documents);

mainMessageTransport(
  IPC_EVENTS.custom_documents_delete,
  custom_documents_delete
);

mainMessageTransport(IPC_EVENTS.custom_documents_store, custom_documents_store);
