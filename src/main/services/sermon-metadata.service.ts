import * as tantivyService from './tantivy.service';
import * as sermonMetadataRepo from '../database/repositories/sermon-metadata.repository';
import type { UpsertSermonMeta } from '../database/repositories/sermon-metadata.repository';

export function buildMetadataFromIndex(langCode: string): void {
    const entries = tantivyService.getUniqueSermonDates(langCode);

    const upserts: UpsertSermonMeta[] = entries.map((entry) => {
        const paragraphCount = tantivyService.getSermonParagraphCount(
            langCode,
            entry.translationId,
        );
        const dateStr = String(entry.sermonDate);
        // Format title as "YY-MMDD" from numeric date like 650101
        const title =
            dateStr.length >= 6 ? `${dateStr.substring(0, 2)}-${dateStr.substring(2, 6)}` : dateStr;

        return {
            translationId: entry.translationId,
            languageCode: langCode,
            sermonDate: dateStr,
            title,
            paragraphCount,
        };
    });

    sermonMetadataRepo.upsertMetadata(upserts);
}
