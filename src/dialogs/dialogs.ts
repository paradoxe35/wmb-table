import { BrowserWindow } from 'electron';
import { mainMessageTransport } from '../message-control/ipc/ipc-main';
import { IPC_EVENTS } from '../utils/ipc-events';
import { export_note_pdf } from './export_notes';

export default (mainWindow: BrowserWindow) => {
  mainMessageTransport(
    IPC_EVENTS.notes_export_pdf,
    (_: any, data: string, name: string) =>
      export_note_pdf(mainWindow, data, name)
  );
};
