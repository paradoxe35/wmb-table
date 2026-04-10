import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { BrowserWindow } from 'electron';
import log from '@main/lib/logger';
import { getAiModelsDir } from '@main/lib/app-paths';
import { PushChannels } from '@shared/ipc.types';
import type { AiModelDownloadProgress } from '@shared/ai.types';
import { sendToRenderer } from '@main/ipc/register';
import { KNOWN_LOCAL_MODELS } from './known-models';
import {
    downloadResumableFile,
    ensureDownloadedFileSize,
    replaceFileAtomically,
} from '@main/lib/resumable-download';

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

        const result = await downloadResumableFile({
            url: knownModel.directDownloadUrl,
            destinationPath: tempPath,
            reuseExistingFile: true,
            onProgress: (progress) => {
                sendProgress(browserWindow, {
                    modelId,
                    percentage: Math.min(progress.percentage, 99),
                    status: 'downloading',
                });
            },
            onWarning: (warning) => {
                log.warn('AI model download warning', {
                    modelId,
                    warning: warning.message,
                });
            },
        });

        const fileStat = await stat(tempPath);
        if (fileStat.size < MIN_VALID_SIZE_BYTES) {
            throw new Error(
                `Downloaded file too small (${fileStat.size} bytes). Expected at least ${MIN_VALID_SIZE_BYTES} bytes.`,
            );
        }
        await ensureDownloadedFileSize(tempPath, result.totalBytes);
        await replaceFileAtomically(tempPath, targetPath);

        log.info('AI model download complete', {
            modelId,
            targetPath,
            sizeBytes: fileStat.size,
        });
        sendProgress(browserWindow, { modelId, percentage: 100, status: 'complete' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Download failed.';
        log.error('AI model download failed', { modelId, error: message });

        sendProgress(browserWindow, { modelId, percentage: 0, status: 'error', error: message });
        throw error;
    } finally {
        activeDownloads.delete(modelId);
    }
}
