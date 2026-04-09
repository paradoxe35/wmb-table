import { app, BrowserWindow, dialog } from 'electron';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PdfExportResult } from '@shared/ipc.types';
import { getMainWindow } from './window';

export type PdfExportDirectory = 'subjects' | 'notes' | 'ai' | 'highlights';

interface PdfExportOptions {
    html: string;
    defaultName: string;
    directory: PdfExportDirectory;
    parentWindow?: BrowserWindow;
}

function getExportDirectoryName(directory: PdfExportDirectory): string {
    switch (directory) {
        case 'subjects':
            return 'Subjects';
        case 'notes':
            return 'Notes';
        case 'ai':
            return 'Assistant Chat';
        case 'highlights':
            return 'Highlights';
    }
}

export async function exportHtmlToPdf({
    html,
    defaultName,
    directory,
    parentWindow,
}: PdfExportOptions): Promise<PdfExportResult> {
    const win = parentWindow ?? getMainWindow() ?? BrowserWindow.getFocusedWindow()!;
    const exportDirectory = join(
        app.getPath('documents'),
        app.getName(),
        getExportDirectoryName(directory),
    );

    await mkdir(exportDirectory, { recursive: true });

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: 'Exporter PDF',
        defaultPath: join(exportDirectory, `${defaultName}.pdf`),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) {
        return { status: 'canceled' };
    }

    const tmpFile = join(tmpdir(), `wmb-export-${randomUUID()}.html`);
    await writeFile(tmpFile, html, 'utf-8');

    const hiddenWindow = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: { offscreen: true },
    });

    try {
        await hiddenWindow.loadFile(tmpFile);
        const pdfBuffer = await hiddenWindow.webContents.printToPDF({
            printBackground: true,
            margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
        });
        await writeFile(filePath, pdfBuffer);
        return { status: 'success', filePath };
    } finally {
        hiddenWindow.destroy();
        unlink(tmpFile).catch(() => {});
    }
}
