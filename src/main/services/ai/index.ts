import type { BrowserWindow } from 'electron';
import { AiService } from './ai.service';

let aiService: AiService | null = null;

export function getAiService(): AiService {
    if (!aiService) {
        aiService = new AiService();
        aiService.removeAbandonedReplies();
    }
    return aiService;
}

/** A reloaded or crashed page cannot re-attach to a run yet, so its runs stop and save. */
export function stopAiRunsWhenPageGoes(browserWindow: BrowserWindow): void {
    const stop = () => aiService?.stopGenerationsForWindow(browserWindow);
    browserWindow.on('closed', stop);
    browserWindow.webContents.on('render-process-gone', stop);
    browserWindow.webContents.on('did-start-navigation', (details) => {
        if (details.isMainFrame && !details.isSameDocument) stop();
    });
}

export function disposeAiService(): void {
    aiService?.dispose();
    aiService = null;
}
