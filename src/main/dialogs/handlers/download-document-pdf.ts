import { BrowserWindow, dialog } from 'electron';
import { Title } from '@localtypes/index';
import isOnline from 'is-online';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import DownloadableRequest from '@main/features/downloadable-request';

export async function downloadDocumentPdf(
  mainWindow: BrowserWindow,
  docTitle: Title
) {
  let path: string | undefined = undefined;

  try {
    const status = await dialog.showSaveDialog(mainWindow, {
      title: 'Enregistrer le document localement',
      filters: [{ name: 'Pdf', extensions: ['pdf'] }],
      defaultPath: `${docTitle.title
        .split(' ')
        .join('-')
        .toLocaleLowerCase()}.pdf`,
    });

    if (status.canceled || !status.filePath) return null;

    const online = await isOnline();

    if (!online) return false;

    path = status.filePath;
  } catch (error) {
    return null;
  }

  const doneProgress = () =>
    mainWindow.webContents.send(
      IPC_EVENTS.download_document_pdf_progress,
      null
    );

  const request = new DownloadableRequest(docTitle.pdf_link!, path);

  request
    .onEnd(doneProgress)
    .onError(doneProgress)
    .onProgress((percentage) => {
      mainWindow.webContents.send(
        IPC_EVENTS.download_document_pdf_progress,
        percentage
      );
    });

  return true;
}
