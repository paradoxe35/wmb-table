import { mainMessageTransport } from './ipc/ipc-main';
import { IPC_EVENTS } from '../utils/ipc-events';
import title_documents from './handlers/title_documents';
import document_content_path from './handlers/document_content_path';
import document_tabs from './handlers/document_tabs';

mainMessageTransport(IPC_EVENTS.title_documents, title_documents);

mainMessageTransport(IPC_EVENTS.document_content_path, document_content_path);

mainMessageTransport(IPC_EVENTS.document_tabs, document_tabs);
