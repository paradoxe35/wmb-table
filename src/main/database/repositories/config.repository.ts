import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { configurations } from '../schema';
import {
    normalizeBibleAbbreviation,
    type AppSettingsStatus,
    type SidebarStatus,
} from '@shared/types';
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
        activeBibleVersionAbbreviation: normalizeBibleAbbreviation(
            row.activeBibleVersionAbbreviation,
        ),
        rememberReadingPosition: row.rememberReadingPosition,
        maxTabs: row.maxTabs ?? DEFAULT_MAX_TABS,
        uiLanguage: (row.uiLanguage as UiLanguagePreference) ?? null,
        sidebarHidden: row.sidebarHidden ?? false,
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

function updateConfig(update: Partial<typeof configurations.$inferInsert>): void {
    getDb().update(configurations).set(update).where(eq(configurations.id, getConfigId())).run();
}

export function markInitialized(): void {
    updateConfig({ initialized: true });
}

export function getContentLanguage(): string | null {
    const config = getConfig();
    return config?.contentLanguage ?? null;
}

export function setContentLanguage(langCode: string | null): void {
    updateConfig({ contentLanguage: langCode });
}

export function getActiveBibleVersionAbbreviation(): string | null {
    return getConfig()?.activeBibleVersionAbbreviation ?? null;
}

export function setActiveBibleVersionAbbreviation(abbreviation: string | null): void {
    updateConfig({ activeBibleVersionAbbreviation: normalizeBibleAbbreviation(abbreviation) });
}

export function updateLastCheckBackupStatus(): void {
    updateConfig({ lastCheckBackupStatus: new Date().toISOString() });
}

export function getRememberReadingPosition(): boolean {
    return getConfig()?.rememberReadingPosition ?? true;
}

export function setRememberReadingPosition(value: boolean): void {
    updateConfig({ rememberReadingPosition: value });
}

export function getMaxTabs(): number {
    return getConfig()?.maxTabs ?? DEFAULT_MAX_TABS;
}

export function setMaxTabs(value: number): number {
    const clamped = Math.max(MIN_MAX_TABS, Math.min(MAX_MAX_TABS, value));
    updateConfig({ maxTabs: clamped });

    return clamped;
}

export function getUiLanguage(): UiLanguagePreference | null {
    return getConfig()?.uiLanguage ?? null;
}

export function setUiLanguage(value: UiLanguagePreference): void {
    updateConfig({ uiLanguage: value === 'auto' ? null : value });
}

export function getSidebarStatus(): SidebarStatus | null {
    const config = getConfig();
    if (!config) {
        return null;
    }

    return {
        hidden: config.sidebarHidden,
    };
}

export function setSidebarStatus(hidden: boolean): void {
    updateConfig({ sidebarHidden: hidden });
}
