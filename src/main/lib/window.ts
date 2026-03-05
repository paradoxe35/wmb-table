import type { BrowserWindow } from 'electron';

let mainWindow: BrowserWindow | null = null;

export function setMainWindow(w: BrowserWindow): void {
    mainWindow = w;
    w.on('closed', () => {
        mainWindow = null;
    });
}

export function getMainWindow(): BrowserWindow | null {
    return mainWindow;
}
