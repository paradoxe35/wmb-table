import { BrowserWindow, dialog } from 'electron';
import { Title } from '@localtypes/index';
import isOnline from 'is-online';
import { createWriteStream } from 'fs';
import request from 'request';
import { IPC_EVENTS } from '@root/utils/ipc-events';

class DownloadableRequest {
  private received_bytes = 0;
  private total_bytes = 0;

  constructor(uri: string, distPath: string) {
    const req = request({
      method: 'GET',
      uri: uri,
    });

    req.on('response', this.onResponse);
    req.on('data', this._onData);
    req.on('error', (err) => this._onError(err));
    req.on('end', () => this._onEnd());
    req.pipe(createWriteStream(distPath));
  }

  private onResponse = (data: request.Response) => {
    // Change the total bytes value to get progress later.
    this.total_bytes = parseInt(data.headers['content-length']!, 10);
  };

  private _onData = (chunk: string | Buffer) => {
    this._onDataFn(chunk);

    this.received_bytes += chunk.length;
    let percentage = (this.received_bytes * 100) / this.total_bytes;

    this._onProgress(percentage);
  };

  private _onError(_err: Error): void {}
  private _onDataFn(_chunk: string | Buffer): void {}
  private _onEnd(): void {}
  private _onProgress(_percentage: number): void {}

  onError(fn: (err: Error) => void) {
    this._onError = fn;
    return this;
  }

  onEnd(fn: () => void) {
    this._onEnd = fn;
    return this;
  }

  onData(fn: (chunk: string | Buffer) => void) {
    this._onDataFn = fn;
    return this;
  }

  onProgress(fn: (percentage: number) => void) {
    this._onProgress = fn;
    return this;
  }
}

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

  const request = new DownloadableRequest(docTitle.audio_link!, path);

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
