import { BrowserWindow } from 'electron';
import { mainMessageTransport } from '@root/ipc/ipc-main';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import { export_note_pdf } from './handlers/export_notes';
import { Title } from '@localtypes/index';
import { downloadDocumentPdf } from './handlers/download-document-pdf';

export default (mainWindow: BrowserWindow) => {
  // export note content in pdf format
  mainMessageTransport(
    IPC_EVENTS.notes_export_pdf,
    (_: any, data: string, name: string) =>
      export_note_pdf(mainWindow, data, name)
  );

  // download document in pdf format
  mainMessageTransport(
    IPC_EVENTS.download_document_pdf,
    (_: any, title: Title) => downloadDocumentPdf(mainWindow, title)
  );
};
