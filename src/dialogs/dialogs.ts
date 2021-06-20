import { BrowserWindow } from 'electron';
import { mainMessageTransport } from '../message-control/ipc/ipc-main';
import { IPC_EVENTS } from '../utils/ipc-events';
import { export_note_pdf, export_note_word } from './export_notes';

export default (mainWindow: BrowserWindow) => {
  mainMessageTransport(
    IPC_EVENTS.notes_export_pdf,
    (_: any, data: string, name: string) =>
      export_note_pdf(mainWindow, data, name)
  );

  mainMessageTransport(
    IPC_EVENTS.notes_export_word,
    (_: any, data: string, name: string) =>
      export_note_word(mainWindow, data, name)
  );
};
