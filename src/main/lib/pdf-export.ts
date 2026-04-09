import { BrowserWindow, dialog } from 'electron';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PdfExportResult } from '@shared/ipc.types';
import { getMainWindow } from './window';

interface PdfExportOptions {
    html: string;
    defaultName: string;
    parentWindow?: BrowserWindow;
}

export async function exportHtmlToPdf({
    html,
    defaultName,
    parentWindow,
}: PdfExportOptions): Promise<PdfExportResult> {
    const win = parentWindow ?? getMainWindow() ?? BrowserWindow.getFocusedWindow()!;

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: 'Exporter PDF',
        defaultPath: `${defaultName}.pdf`,
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
