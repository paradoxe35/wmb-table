import { ipcMain } from 'electron';

export async function mainMessageTransport(
  eventName: string,
  callback: (event: Electron.IpcMainEvent, ...args: any[]) => any
) {
  ipcMain.on(eventName, (event, ...arg) => {
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
  });
}
