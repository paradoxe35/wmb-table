import { HighlightChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as highlightsRepo from '@main/database/repositories/highlights.repository';
import { exportHtmlToPdf } from '@main/lib/pdf-export';
import { buildHighlightsExportHtml } from '@main/lib/highlights-export';

export function registerHighlightsHandlers(): void {
    registerHandler(
        HighlightChannels.search,
        async (_event, query, page, pageSize, languageCode) => {
            return highlightsRepo.search(query, page, pageSize, languageCode);
        },
    );

    registerHandler(HighlightChannels.getByDocument, async (_event, documentTitle, sermonId) => {
        return highlightsRepo.getByDocument(documentTitle, sermonId);
    });

    registerHandler(HighlightChannels.create, async (_event, data) => {
        return highlightsRepo.create(data);
    });

    registerHandler(HighlightChannels.update, async (_event, id, data) => {
        return highlightsRepo.update(id, data);
    });

    registerHandler(HighlightChannels.delete, async (_event, id) => {
        highlightsRepo.deleteHighlight(id);
    });

    registerHandler(HighlightChannels.exportPdf, async (_event, languageCode) => {
        const result = highlightsRepo.search('', 0, 99999, languageCode);
        if (result.items.length === 0) return '';

        const html = await buildHighlightsExportHtml(result.items);
        return exportHtmlToPdf({ html, defaultName: 'soulignages' });
    });
}
