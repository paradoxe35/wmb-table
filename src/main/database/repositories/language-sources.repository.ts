import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { installedLanguageSources } from '../schema';

export type InstalledLanguageSourceType = 'primary' | 'github';

export interface StoredLanguageHeaders {
    etag: string | null;
    lastModified: string | null;
    contentLength: number | null;
    versionId: string | null;
}

export interface StoredInstalledLanguageSource extends StoredLanguageHeaders {
    langCode: string;
    sourceType: InstalledLanguageSourceType;
    sourceUrl: string;
    fileName: string;
    updateAvailable: boolean;
    installedAt: Date | null;
    lastCheckedAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
}

export interface UpsertInstalledLanguageSourceInput extends StoredLanguageHeaders {
    langCode: string;
    sourceType: InstalledLanguageSourceType;
    sourceUrl: string;
    fileName: string;
    updateAvailable?: boolean;
    installedAt?: string;
    lastCheckedAt?: string | null;
}

function mapRow(
    row: typeof installedLanguageSources.$inferSelect | undefined,
): StoredInstalledLanguageSource | null {
    if (!row) {
        return null;
    }

    return {
        langCode: row.langCode,
        sourceType: row.sourceType as InstalledLanguageSourceType,
        sourceUrl: row.sourceUrl,
        fileName: row.fileName,
        etag: row.etag ?? null,
        lastModified: row.lastModified ?? null,
        contentLength: row.contentLength ?? null,
        versionId: row.versionId ?? null,
        updateAvailable: row.updateAvailable,
        installedAt: row.installedAt ? new Date(row.installedAt) : null,
        lastCheckedAt: row.lastCheckedAt ? new Date(row.lastCheckedAt) : null,
        createdAt: row.createdAt ? new Date(row.createdAt) : null,
        updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
}

export function getInstalledLanguageSource(langCode: string): StoredInstalledLanguageSource | null {
    const row = getDb()
        .select()
        .from(installedLanguageSources)
        .where(eq(installedLanguageSources.langCode, langCode))
        .get();

    return mapRow(row);
}

export function upsertInstalledLanguageSource(
    input: UpsertInstalledLanguageSourceInput,
): StoredInstalledLanguageSource {
    const now = new Date().toISOString();

    getDb()
        .insert(installedLanguageSources)
        .values({
            langCode: input.langCode,
            sourceType: input.sourceType,
            sourceUrl: input.sourceUrl,
            fileName: input.fileName,
            etag: input.etag,
            lastModified: input.lastModified,
            contentLength: input.contentLength,
            versionId: input.versionId,
            updateAvailable: input.updateAvailable ?? false,
            installedAt: input.installedAt ?? now,
            lastCheckedAt: input.lastCheckedAt ?? now,
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: installedLanguageSources.langCode,
            set: {
                sourceType: input.sourceType,
                sourceUrl: input.sourceUrl,
                fileName: input.fileName,
                etag: input.etag,
                lastModified: input.lastModified,
                contentLength: input.contentLength,
                versionId: input.versionId,
                updateAvailable: input.updateAvailable ?? false,
                installedAt: input.installedAt ?? now,
                lastCheckedAt: input.lastCheckedAt ?? now,
                updatedAt: now,
            },
        })
        .run();

    return getInstalledLanguageSource(input.langCode)!;
}

export function setInstalledLanguageUpdateStatus(
    langCode: string,
    input: { updateAvailable: boolean; lastCheckedAt?: string | null },
): void {
    const now = new Date().toISOString();
    getDb()
        .update(installedLanguageSources)
        .set({
            updateAvailable: input.updateAvailable,
            lastCheckedAt: input.lastCheckedAt ?? now,
            updatedAt: now,
        })
        .where(eq(installedLanguageSources.langCode, langCode))
        .run();
}

export function deleteInstalledLanguageSource(langCode: string): void {
    getDb()
        .delete(installedLanguageSources)
        .where(eq(installedLanguageSources.langCode, langCode))
        .run();
}
