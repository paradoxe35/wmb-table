import { mainWindow } from '@root/sys';
import { ipcMain } from 'electron';

export function mainMessageTransport(
  eventName: string,
  callback: (event: Electron.IpcMainEvent, ...args: any[]) => any
) {
  const callable = (event: Electron.IpcMainEvent, ...arg: any[]) => {
    const cb = callback(event, ...arg);
    if (cb instanceof Promise) {
      cb.then((data) => event.reply(`${eventName}-reply`, null, data)).catch(
        (err) => {
          console.log('error ----------------', err);
          event.reply(`${eventName}-reply`, err, null);
        }
      );
    } else {
      event.reply(`${eventName}-reply`, null, cb);
    }
  };

  ipcMain.on(eventName, callable);

  return () => {
    ipcMain.off(eventName, callable);
  };
}

export function sendIpcToRenderer(channel: string, ...args: any[]) {
  mainWindow?.webContents.send(channel, ...args);
}
