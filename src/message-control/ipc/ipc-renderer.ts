import electron from 'electron';

const { ipcRenderer } = electron;

export default function sendIpcRequest<T>(eventName: string, ...args: any[]) {
  return new Promise((resolve, reject) => {
    ipcRenderer.once(`${eventName}-reply`, (_, error, arg: T) => {
      if (error) {
        reject(error);
      } else {
        resolve(arg);
      }
    });
    ipcRenderer.send(eventName, args);
  }) as Promise<T>;
}
