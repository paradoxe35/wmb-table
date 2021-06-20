import { BrowserWindow, dialog } from 'electron';

const pdf = require('html-pdf');

export function export_note_pdf(
  mainWindow: BrowserWindow,
  data: string,
  name: string
) {
  const path = dialog.showSaveDialogSync(mainWindow, {
    title: 'Exporter PDF',
    filters: [{ name: 'Pdf', extensions: ['pdf'] }],
    defaultPath: `${name.split(' ').join('-').toLocaleLowerCase()}.pdf`,
  });

  pdf.create(data, { format: 'A4' }).toFile(path, () => {});

  return true;
}
