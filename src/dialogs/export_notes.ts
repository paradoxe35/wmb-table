import { BrowserWindow, dialog } from 'electron';

const pdf = require('html-pdf');
const fs = require('fs');

const HTMLtoDOCX = require('html-to-docx');

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
export async function export_note_word(
  mainWindow: BrowserWindow,
  data: string,
  name: string
) {
  const path = dialog.showSaveDialogSync(mainWindow, {
    title: 'Exporter Word',
    filters: [{ name: 'Docx', extensions: ['docx'] }],
    defaultPath: `${name.split(' ').join('-').toLocaleLowerCase()}.docx`,
  });

  const fileBuffer = await HTMLtoDOCX(data);

  fs.writeFile(path, fileBuffer, () => {});

  return true;
}
