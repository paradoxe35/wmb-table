import { BrowserWindow, dialog } from 'electron';
import { childsProcessesPath } from '../../sys';
import childProcess from 'child_process';

export async function export_note_pdf(
  mainWindow: BrowserWindow,
  data: string,
  name: string
) {
  let path: string | undefined = undefined;

  try {
    path = dialog.showSaveDialogSync(mainWindow, {
      title: 'Exporter PDF',
      filters: [{ name: 'Pdf', extensions: ['pdf'] }],
      defaultPath: `${name.split(' ').join('-').toLocaleLowerCase()}.pdf`,
    });
  } catch (error) {
    return false;
  }

  process.env.FILE_PATH = path;
  process.env.HTML_DATA = data;

  const child = childProcess.fork(childsProcessesPath('html-pdf.js'), {
    env: process.env,
  });

  const value = await new Promise<any>((resolve) => {
    child.once('message', resolve);
  });

  child.kill('SIGINT');

  return !!value;
}
