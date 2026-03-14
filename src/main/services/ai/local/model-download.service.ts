import { createWriteStream } from 'node:fs';
import { rename, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { BrowserWindow } from 'electron';
import log from '@main/lib/logger';
import { getAiModelsDir } from '@main/lib/app-paths';
import { PushChannels } from '@shared/ipc.types';
import type { AiModelDownloadProgress } from '@shared/ai.types';
import { sendToRenderer } from '@main/ipc/register';
import { KNOWN_LOCAL_MODELS } from './known-models';

const MIN_VALID_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB minimum for a GGUF file
const activeDownloads = new Set<string>();

function sendProgress(browserWindow: BrowserWindow, progress: AiModelDownloadProgress): void {
    if (!browserWindow.isDestroyed()) {
        sendToRenderer(browserWindow, PushChannels.aiModelDownloadProgress, progress);
    }
}

export async function downloadLocalModel(
    browserWindow: BrowserWindow,
    modelId: string,
): Promise<void> {
    if (activeDownloads.has(modelId)) {
        log.warn('AI model download already in progress', { modelId });
        return;
    }

    const knownModel = KNOWN_LOCAL_MODELS.find((m) => m.id === modelId);
    if (!knownModel) {
        throw new Error(`Unknown model: ${modelId}`);
    }

    activeDownloads.add(modelId);
    const modelsDir = getAiModelsDir();
    const targetPath = join(modelsDir, knownModel.expectedFileName);
    const tempPath = `${targetPath}.download`;

    log.info('AI model download starting', { modelId, url: knownModel.directDownloadUrl });

    try {
        sendProgress(browserWindow, { modelId, percentage: 0, status: 'downloading' });

        const response = await fetch(knownModel.directDownloadUrl, { redirect: 'follow' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentLength = Number(response.headers.get('content-length') ?? 0);
        const body = response.body;
        if (!body) {
            throw new Error('Empty response body.');
        }

        let downloaded = 0;
        let lastReportedPct = 0;

        const progressStream = new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                downloaded += chunk.byteLength;
                if (contentLength > 0) {
                    const pct = Math.round((downloaded / contentLength) * 100);
                    if (pct > lastReportedPct) {
                        lastReportedPct = pct;
                        sendProgress(browserWindow, {
                            modelId,
                            percentage: Math.min(pct, 99),
                            status: 'downloading',
                        });
                    }
                }
                controller.enqueue(chunk);
            },
        });

        const nodeStream = Readable.fromWeb(body.pipeThrough(progressStream) as never);
        const fileStream = createWriteStream(tempPath);

        await pipeline(nodeStream, fileStream);

        // Validate the downloaded file
        const fileStat = await stat(tempPath);
        if (fileStat.size < MIN_VALID_SIZE_BYTES) {
            throw new Error(
                `Downloaded file too small (${fileStat.size} bytes). Expected at least ${MIN_VALID_SIZE_BYTES} bytes.`,
            );
        }
        if (contentLength > 0 && fileStat.size !== contentLength) {
            throw new Error(
                `Incomplete download: got ${fileStat.size} bytes, expected ${contentLength}.`,
            );
        }

        await rename(tempPath, targetPath);

        log.info('AI model download complete', {
            modelId,
            targetPath,
            sizeBytes: fileStat.size,
        });
        sendProgress(browserWindow, { modelId, percentage: 100, status: 'complete' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Download failed.';
        log.error('AI model download failed', { modelId, error: message });

        await unlink(tempPath).catch(() => {});

        sendProgress(browserWindow, { modelId, percentage: 0, status: 'error', error: message });
        throw error;
    } finally {
        activeDownloads.delete(modelId);
    }
}
