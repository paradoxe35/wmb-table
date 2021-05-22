import { ipcMain } from 'electron';

ipcMain.on('asynchronous-message', (event, arg) => {
  if (arg === 'ping') event.reply('asynchronous-reply', 'pong!');
  else event.reply('asynchronous-reply', 'please, send me ping.');
});
