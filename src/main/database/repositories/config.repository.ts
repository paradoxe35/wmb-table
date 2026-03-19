import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { configurations } from '../schema';
import type { AppSettingsStatus } from '@shared/types';
import {
    DEFAULT_MAX_TABS,
    MIN_MAX_TABS,
    MAX_MAX_TABS,
    type UiLanguagePreference,
} from '@shared/constants';

export function getConfig(): AppSettingsStatus | null {
    const row = getDb().select().from(configurations).get();
    if (!row) return null;
    return {
        id: row.id,
        app_id: row.appId,
        initialized: row.initialized,
        lastCheckBackupStatus: new Date(row.lastCheckBackupStatus ?? Date.now()),
        contentLanguage: row.contentLanguage ?? null,
        rememberReadingPosition: row.rememberReadingPosition,
        maxTabs: row.maxTabs ?? DEFAULT_MAX_TABS,
        uiLanguage: row.uiLanguage ?? null,
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

export function getContentLanguage(): string | null {
    const config = getConfig();
    return config?.contentLanguage ?? null;
}

export function setContentLanguage(langCode: string): void {
    const config = ensureConfig();
    getDb()
        .update(configurations)
        .set({ contentLanguage: langCode })
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

export function getRememberReadingPosition(): boolean {
    return getConfig()?.rememberReadingPosition ?? true;
}

export function setRememberReadingPosition(value: boolean): void {
    const config = ensureConfig();
    getDb()
        .update(configurations)
        .set({ rememberReadingPosition: value })
        .where(eq(configurations.id, config.id))
        .run();
}

export function getMaxTabs(): number {
    return getConfig()?.maxTabs ?? DEFAULT_MAX_TABS;
}

export function setMaxTabs(value: number): void {
    const clamped = Math.max(MIN_MAX_TABS, Math.min(MAX_MAX_TABS, value));
    const config = ensureConfig();
    getDb()
        .update(configurations)
        .set({ maxTabs: clamped })
        .where(eq(configurations.id, config.id))
        .run();
}

export function getUiLanguage(): string | null {
    return getConfig()?.uiLanguage ?? null;
}

export function setUiLanguage(value: UiLanguagePreference): void {
    const config = ensureConfig();
    getDb()
        .update(configurations)
        .set({ uiLanguage: value === 'auto' ? null : value })
        .where(eq(configurations.id, config.id))
        .run();
}
