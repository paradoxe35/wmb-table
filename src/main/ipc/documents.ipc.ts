import { DocumentChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as tabsRepo from '@main/database/repositories/tabs.repository';
import * as tantivyService from '@main/services/tantivy.service';
import * as referenceDataService from '@main/services/reference-data.service';
import { getInstalledLanguages } from '@main/services/tantivy.service';

export function registerDocumentsHandlers(): void {
    registerHandler(DocumentChannels.getTitles, async (_event, langCode) => {
        return referenceDataService.getSermonListDeduplicated(langCode);
    });

    registerHandler(
        DocumentChannels.getSermonContent,
        async (_event, langCode, translationId, sermonDate) => {
            const meta = referenceDataService.getSermonMeta(translationId, langCode, sermonDate);
            if (!meta)
                throw new Error(
                    `Sermon not found: tid=${translationId} date=${sermonDate} (${langCode})`,
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
        DocumentChannels.getTraductionsForSermon,
        async (_event, sermonDate, langCode) => {
            return referenceDataService.getTraductionsForSermon(sermonDate, langCode);
        },
    );

    registerHandler(DocumentChannels.getTabs, async (_event, langCode) => {
        return tabsRepo.getTabs(langCode);
    });

    registerHandler(DocumentChannels.saveTabs, async (_event, langCode, datas) => {
        tabsRepo.saveTabs(langCode, datas);
    });
}
