import { DocumentChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as sermonMetadataRepo from '@main/database/repositories/sermon-metadata.repository';
import * as tabsRepo from '@main/database/repositories/tabs.repository';
import * as tantivyService from '@main/services/tantivy.service';

export function registerDocumentsHandlers(): void {
    registerHandler(DocumentChannels.getTitles, async (_event, langCode) => {
        return sermonMetadataRepo.getSermonList(langCode);
    });

    registerHandler(DocumentChannels.getSermonContent, async (_event, langCode, translationId) => {
        const meta = sermonMetadataRepo.getSermonMeta(translationId, langCode);
        if (!meta) throw new Error(`Sermon not found: ${translationId} (${langCode})`);
        const paragraphs = tantivyService.getSermonParagraphs(langCode, translationId);
        return { meta, paragraphs };
    });

    registerHandler(DocumentChannels.getSermonList, async (_event, langCode, options) => {
        return sermonMetadataRepo.getSermonList(langCode, options);
    });

    registerHandler(DocumentChannels.getSermonsByYear, async (_event, langCode) => {
        return sermonMetadataRepo.getSermonsByYear(langCode);
    });

    registerHandler(DocumentChannels.getTranslations, async (_event, translationId) => {
        return sermonMetadataRepo.getAvailableTranslations(translationId);
    });

    registerHandler(DocumentChannels.getTabs, async () => {
        return tabsRepo.getTabs();
    });

    registerHandler(DocumentChannels.saveTabs, async (_event, datas) => {
        tabsRepo.saveTabs(datas);
    });
}
