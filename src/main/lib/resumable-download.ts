import { existsSync } from 'node:fs';
import { mkdir, rename, rm, stat, unlink } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { DownloaderHelper } from 'node-downloader-helper';

export interface DownloadRetryOptions {
    maxRetries: number;
    delayMs: number;
}

export interface ResumableDownloadProgress {
    downloadedBytes: number;
    totalBytes: number | null;
    percentage: number;
    speedBytesPerSecond: number;
    resumable: boolean;
    resumed: boolean;
}

export interface ResumableDownloadOptions {
    url: string;
    destinationPath: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    retry?: DownloadRetryOptions;
    progressThrottleMs?: number;
    forceResume?: boolean;
    reuseExistingFile?: boolean;
    onProgress?: (progress: ResumableDownloadProgress) => void;
    onWarning?: (warning: Error) => void;
}

export interface ResumableDownloadResult {
    filePath: string;
    totalBytes: number | null;
    downloadedBytes: number;
    resumable: boolean;
    resumed: boolean;
}

type DownloaderError = Error & {
    status?: number;
    body?: string;
};

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_PROGRESS_THROTTLE_MS = 500;
const DEFAULT_RETRY: DownloadRetryOptions = {
    maxRetries: 5,
    delayMs: 1_500,
};

function normalizeDownloaderError(error: unknown): DownloaderError {
    if (error instanceof Error) {
        return error as DownloaderError;
    }

    const message =
        error &&
        typeof error === 'object' &&
        typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message
            : 'Download failed.';

    const normalized = new Error(message) as DownloaderError;
    if (error && typeof error === 'object') {
        if (typeof (error as { status?: unknown }).status === 'number') {
            normalized.status = (error as { status: number }).status;
        }
        if (typeof (error as { body?: unknown }).body === 'string') {
            normalized.body = (error as { body: string }).body;
        }
    }
    return normalized;
}

function shouldRetryFresh(error: DownloaderError): boolean {
    if (error.status === 416) {
        return true;
    }

    const message = error.message.toLowerCase();
    return message.includes('416') || message.includes('range');
}

async function getRemoteContentLength(
    options: Pick<ResumableDownloadOptions, 'url' | 'headers' | 'timeoutMs'>,
): Promise<number | null> {
    try {
        const response = await fetch(options.url, {
            method: 'HEAD',
            headers: options.headers,
            redirect: 'follow',
            signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        });
        if (!response.ok) {
            return null;
        }

        const value = response.headers.get('content-length');
        if (!value) {
            return null;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } catch {
        return null;
    }
}

async function maybeReuseExistingFile(
    options: ResumableDownloadOptions,
): Promise<ResumableDownloadResult | null> {
    if (!options.reuseExistingFile || !existsSync(options.destinationPath)) {
        return null;
    }

    const remoteContentLength = await getRemoteContentLength(options);
    if (remoteContentLength == null) {
        return null;
    }

    const localStat = await stat(options.destinationPath).catch(() => null);
    if (!localStat || localStat.size !== remoteContentLength) {
        return null;
    }

    options.onProgress?.({
        downloadedBytes: localStat.size,
        totalBytes: remoteContentLength,
        percentage: 100,
        speedBytesPerSecond: 0,
        resumable: true,
        resumed: true,
    });

    return {
        filePath: options.destinationPath,
        totalBytes: remoteContentLength,
        downloadedBytes: localStat.size,
        resumable: true,
        resumed: true,
    };
}

async function runDownload(options: ResumableDownloadOptions): Promise<ResumableDownloadResult> {
    await mkdir(dirname(options.destinationPath), { recursive: true });

    const retry = options.retry ?? DEFAULT_RETRY;
    const downloader = new DownloaderHelper(options.url, dirname(options.destinationPath), {
        fileName: basename(options.destinationPath),
        headers: options.headers ?? {},
        override: true,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        retry: { maxRetries: retry.maxRetries, delay: retry.delayMs },
        resumeIfFileExists: true,
        resumeOnIncomplete: true,
        removeOnFail: false,
        removeOnStop: false,
        progressThrottle: options.progressThrottleMs ?? DEFAULT_PROGRESS_THROTTLE_MS,
        forceResume: options.forceResume ?? false,
    });

    return await new Promise<ResumableDownloadResult>((resolve, reject) => {
        let settled = false;
        let resumed = existsSync(options.destinationPath);
        let resumable = false;

        const cleanup = () => {
            downloader.removeAllListeners('download');
            downloader.removeAllListeners('progress');
            downloader.removeAllListeners('progress.throttled');
            downloader.removeAllListeners('end');
            downloader.removeAllListeners('error');
            downloader.removeAllListeners('warning');
        };

        const fail = (error: unknown) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            reject(normalizeDownloaderError(error));
        };

        downloader.on('download', (info) => {
            resumed = info.isResumed;
            resumable = downloader.isResumable();
        });

        downloader.on('progress.throttled', (stats) => {
            resumable = downloader.isResumable();
            options.onProgress?.({
                downloadedBytes: stats.downloaded,
                totalBytes: stats.total,
                percentage: Number.isFinite(stats.progress) ? Math.round(stats.progress) : 0,
                speedBytesPerSecond: stats.speed,
                resumable,
                resumed,
            });
        });

        downloader.on('warning', (warning) => {
            options.onWarning?.(warning);
        });

        downloader.on('error', fail);

        downloader.on('end', (info) => {
            if (settled) {
                return;
            }

            if (info.incomplete) {
                fail(
                    Object.assign(new Error('Download completed with missing data.'), {
                        status: 0,
                    }),
                );
                return;
            }

            settled = true;
            cleanup();
            resolve({
                filePath: info.filePath,
                totalBytes: info.totalSize,
                downloadedBytes: info.downloadedSize,
                resumable,
                resumed,
            });
        });

        downloader.start().catch(fail);
    });
}

export async function downloadResumableFile(
    options: ResumableDownloadOptions,
): Promise<ResumableDownloadResult> {
    const reused = await maybeReuseExistingFile(options);
    if (reused) {
        return reused;
    }

    try {
        return await runDownload(options);
    } catch (error) {
        const normalized = normalizeDownloaderError(error);
        if (shouldRetryFresh(normalized) && existsSync(options.destinationPath)) {
            await unlink(options.destinationPath).catch(() => {});
            return runDownload(options);
        }
        throw normalized;
    }
}

export async function replaceFileAtomically(sourcePath: string, targetPath: string): Promise<void> {
    await mkdir(dirname(targetPath), { recursive: true });

    if (!existsSync(targetPath)) {
        await rename(sourcePath, targetPath);
        return;
    }

    try {
        await rename(sourcePath, targetPath);
        return;
    } catch {
        const backupPath = `${targetPath}.bak-replace`;
        await rm(backupPath, { force: true }).catch(() => {});
        await rename(targetPath, backupPath);
        try {
            await rename(sourcePath, targetPath);
            await rm(backupPath, { force: true }).catch(() => {});
        } catch (error) {
            if (!existsSync(targetPath) && existsSync(backupPath)) {
                await rename(backupPath, targetPath).catch(() => {});
            }
            throw error;
        }
    }
}

export async function ensureDownloadedFileSize(
    filePath: string,
    expectedSize: number | null | undefined,
): Promise<void> {
    if (expectedSize == null || expectedSize <= 0) {
        return;
    }

    const current = await stat(filePath);
    if (current.size !== expectedSize) {
        throw new Error(
            `Incomplete download: got ${current.size} bytes, expected ${expectedSize}.`,
        );
    }
}
