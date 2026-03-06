import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { configurations } from '../schema';
import type { AppSettingsStatus } from '@shared/types';

export function getConfig(): AppSettingsStatus | null {
    const row = getDb().select().from(configurations).get();
    if (!row) return null;
    return {
        id: row.id,
        app_id: row.appId,
        initialized: row.initialized,
        lastCheckBackupStatus: new Date(row.lastCheckBackupStatus ?? Date.now()),
        activeLanguage: row.activeLanguage ?? null,
    };
}

export function ensureConfig(): AppSettingsStatus {
    const existing = getConfig();
    if (existing) return existing;

    const id = randomUUID();
    const appId = randomUUID();
    getDb().insert(configurations).values({ id, appId, initialized: false }).run();
    return getConfig()!;
}

export function markInitialized(): void {
    const config = ensureConfig();
    getDb()
        .update(configurations)
        .set({ initialized: true })
        .where(eq(configurations.id, config.id))
        .run();
}

export function getActiveLanguage(): string | null {
    const config = getConfig();
    return config?.activeLanguage ?? null;
}

export function setActiveLanguage(langCode: string): void {
    const config = ensureConfig();
    getDb()
        .update(configurations)
        .set({ activeLanguage: langCode })
        .where(eq(configurations.id, config.id))
        .run();
}

export function updateLastCheckBackupStatus(): void {
    const config = ensureConfig();
    getDb()
        .update(configurations)
        .set({ lastCheckBackupStatus: new Date().toISOString() })
        .where(eq(configurations.id, config.id))
        .run();
}
