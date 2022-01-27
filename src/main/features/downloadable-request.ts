import { createWriteStream } from 'fs';
import request from 'request';

export default class DownloadableRequest {
  private received_bytes = 0;
  private total_bytes = 0;

  constructor(uri: string, distPath: string) {
    const req = request({
      method: 'GET',
      uri: uri,
    });

    req.on('response', this.onResponse);
    req.on('data', this._onData);
    req.on('error', (err: Error) => this._onError(err));
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
