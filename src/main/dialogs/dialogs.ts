import { BrowserWindow } from 'electron';
import { mainMessageTransport } from '@root/ipc/ipc-main';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import { export_note_pdf } from './handlers/export_notes';

export default (mainWindow: BrowserWindow) => {
  mainMessageTransport(
    IPC_EVENTS.notes_export_pdf,
    (_: any, data: string, name: string) =>
      export_note_pdf(mainWindow, data, name)
  );
};
