import { DocumentChannels } from '@shared/ipc.types';
import { registerHandler } from './ipc-bridge';
import * as tabsRepo from '@main/database/repositories/tabs.repository';
import * as readingPositionsRepo from '@main/database/repositories/reading-positions.repository';
import * as tantivyService from '@main/services/tantivy.service';
import * as referenceDataService from '@main/services/reference-data.service';
import { getInstalledLanguages } from '@main/services/tantivy.service';

export function registerDocumentsHandlers(): void {
    registerHandler(DocumentChannels.getTitles, async (_event, langCode) => {
        return referenceDataService.getSermonListDeduplicated(langCode);
    });

    registerHandler(
        DocumentChannels.getSermonContent,
        async (_event, langCode, translationId, sermonId) => {
            const meta = referenceDataService.getSermonMeta(translationId, langCode, sermonId);
            if (!meta)
                throw new Error(
                    `Sermon not found: tid=${translationId} sermonId=${sermonId} (${langCode})`,
                );
            const paragraphs = await tantivyService.getSermonParagraphs(
                langCode,
                translationId,
                meta.dateMs,
            );
            return { meta, paragraphs };
        },
    );

    registerHandler(DocumentChannels.getSermonList, async (_event, langCode, _options) => {
        return referenceDataService.getSermonListForLanguage(langCode);
    });

    registerHandler(DocumentChannels.getSermonsByYear, async (_event, langCode) => {
        return referenceDataService.getSermonsByYear(langCode);
    });

    registerHandler(DocumentChannels.getTranslations, async (_event, sermonId) => {
        const installed = getInstalledLanguages();
        return referenceDataService.getTranslationsForSermon(sermonId, installed);
    });

    registerHandler(
        DocumentChannels.getTranslationsForSermonInLanguage,
        async (_event, sermonId, langCode) => {
            return referenceDataService.getTranslationsForSermonInLanguage(sermonId, langCode);
        },
    );

    registerHandler(DocumentChannels.getTabs, async (_event, langCode) => {
        return tabsRepo.getTabs(langCode);
    });

    registerHandler(DocumentChannels.saveTabs, async (_event, langCode, datas) => {
        tabsRepo.saveTabs(langCode, datas);
    });

    registerHandler(DocumentChannels.getReadingPosition, async (_event, documentKey) => {
        return readingPositionsRepo.getReadingPosition(documentKey);
    });

    registerHandler(
        DocumentChannels.saveReadingPosition,
        async (_event, documentKey, scrollY, scrollX) => {
            return readingPositionsRepo.saveReadingPosition(documentKey, scrollY, scrollX);
        },
    );
}
