import { app, BrowserWindow, dialog } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import htmlToDocx from '@turbodocx/html-to-docx';
import type { PdfExportResult } from '@shared/ipc.types';
import { getMainWindow } from './window';
import { slugifyFilename } from './slugify';
import type { PdfExportDirectory } from './pdf-export';

interface DocxExportOptions {
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

export async function exportHtmlToDocx({
    html,
    defaultName,
    directory,
    parentWindow,
}: DocxExportOptions): Promise<PdfExportResult> {
    const win = parentWindow ?? getMainWindow() ?? BrowserWindow.getFocusedWindow()!;
    const exportDirectory = join(
        app.getPath('documents'),
        app.getName(),
        getExportDirectoryName(directory),
    );

    await mkdir(exportDirectory, { recursive: true });

    const safeName = slugifyFilename(defaultName);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: 'Exporter DOCX',
        defaultPath: join(exportDirectory, `${safeName}.docx`),
        filters: [{ name: 'Word Document', extensions: ['docx'] }],
    });

    if (canceled || !filePath) {
        return { status: 'canceled' };
    }

    const docx = await htmlToDocx(html, null, {
        orientation: 'portrait',
        margins: { top: 720, bottom: 720, left: 720, right: 720 },
    });
    const docxBuffer = Buffer.isBuffer(docx) ? docx : Buffer.from(docx as ArrayBuffer);
    await writeFile(filePath, docxBuffer);
    return { status: 'success', filePath };
}
