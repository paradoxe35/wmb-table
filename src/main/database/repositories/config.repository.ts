import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { configurations } from '../schema';
import { normalizeBibleAbbreviation, type AppSettingsStatus } from '@shared/types';
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
        activeBibleVersionAbbreviation: row.activeBibleVersionAbbreviation
            ? normalizeBibleAbbreviation(row.activeBibleVersionAbbreviation)
            : null,
        rememberReadingPosition: row.rememberReadingPosition,
        maxTabs: row.maxTabs ?? DEFAULT_MAX_TABS,
        uiLanguage: (row.uiLanguage as UiLanguagePreference) ?? null,
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

/** Get the single config row's ID, creating it if needed. */
function getConfigId(): string {
    const row = getDb().select({ id: configurations.id }).from(configurations).get();
    if (row) return row.id;
    return ensureConfig().id;
}

export function markInitialized(): void {
    getDb()
        .update(configurations)
        .set({ initialized: true })
        .where(eq(configurations.id, getConfigId()))
        .run();
}

export function getContentLanguage(): string | null {
    const config = getConfig();
    return config?.contentLanguage ?? null;
}

export function setContentLanguage(langCode: string | null): void {
    getDb()
        .update(configurations)
        .set({ contentLanguage: langCode })
        .where(eq(configurations.id, getConfigId()))
        .run();
}

export function getActiveBibleVersionAbbreviation(): string | null {
    return getConfig()?.activeBibleVersionAbbreviation ?? null;
}

export function setActiveBibleVersionAbbreviation(abbreviation: string | null): void {
    getDb()
        .update(configurations)
        .set({
            activeBibleVersionAbbreviation: abbreviation
                ? normalizeBibleAbbreviation(abbreviation)
                : null,
        })
        .where(eq(configurations.id, getConfigId()))
        .run();
}

export function updateLastCheckBackupStatus(): void {
    getDb()
        .update(configurations)
        .set({ lastCheckBackupStatus: new Date().toISOString() })
        .where(eq(configurations.id, getConfigId()))
        .run();
}

export function getRememberReadingPosition(): boolean {
    return getConfig()?.rememberReadingPosition ?? true;
}

export function setRememberReadingPosition(value: boolean): void {
    getDb()
        .update(configurations)
        .set({ rememberReadingPosition: value })
        .where(eq(configurations.id, getConfigId()))
        .run();
}

export function getMaxTabs(): number {
    return getConfig()?.maxTabs ?? DEFAULT_MAX_TABS;
}

export function setMaxTabs(value: number): number {
    const clamped = Math.max(MIN_MAX_TABS, Math.min(MAX_MAX_TABS, value));
    getDb()
        .update(configurations)
        .set({ maxTabs: clamped })
        .where(eq(configurations.id, getConfigId()))
        .run();

    return clamped;
}

export function getUiLanguage(): UiLanguagePreference | null {
    return getConfig()?.uiLanguage ?? null;
}

export function setUiLanguage(value: UiLanguagePreference): void {
    getDb()
        .update(configurations)
        .set({ uiLanguage: value === 'auto' ? null : value })
        .where(eq(configurations.id, getConfigId()))
        .run();
}
