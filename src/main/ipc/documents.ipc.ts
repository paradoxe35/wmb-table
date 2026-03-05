import { DocumentChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as tabsRepo from '@main/database/repositories/tabs.repository';
import * as tantivyService from '@main/services/tantivy.service';
import * as referenceDataService from '@main/services/reference-data.service';
import * as refRepo from '@main/database/repositories/reference.repository';

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
            const tantivyDate = refRepo.sermonIdToTantivyDate(sermonDate);
            const paragraphs = tantivyService.getSermonParagraphs(
                langCode,
                translationId,
                tantivyDate,
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
        return referenceDataService.getTranslationsForSermon(sermonId);
    });

    registerHandler(
        DocumentChannels.getTraductionsForSermon,
        async (_event, sermonDate, langCode) => {
            return referenceDataService.getTraductionsForSermon(sermonDate, langCode);
        },
    );

    registerHandler(DocumentChannels.getTabs, async () => {
        return tabsRepo.getTabs();
    });

    registerHandler(DocumentChannels.saveTabs, async (_event, datas) => {
        tabsRepo.saveTabs(datas);
    });
}
