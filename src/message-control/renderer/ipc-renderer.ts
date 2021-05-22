import electron from 'electron';

const { ipcRenderer } = electron;

export default function send(message: unknown) {
  return new Promise((resolve) => {
    ipcRenderer.once('asynchronous-reply', (_: unknown, arg: unknown) => {
      resolve(arg);
    });
    ipcRenderer.send('asynchronous-message', message);
  });
}
