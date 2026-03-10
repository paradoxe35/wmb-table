import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { safeStorage } from 'electron';
import { getDb } from '../index';
import { ttsSettings } from '../schema';
import type {
    TtsHighlightMode,
    TtsSettings,
    TtsProviderSettings,
    TtsProviderType,
} from '@shared/tts.types';
import { createDefaultTtsSettings } from '@shared/tts.types';

function encryptApiKey(key: string): string {
    if (!key || !safeStorage.isEncryptionAvailable()) return key;
    return safeStorage.encryptString(key).toString('base64');
}

function decryptApiKey(encrypted: string): string {
    if (!encrypted || !safeStorage.isEncryptionAvailable()) return encrypted;
    try {
        return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    } catch {
        return encrypted;
    }
}

function encryptProviderConfigs(
    configs: Record<TtsProviderType, TtsProviderSettings>,
): Record<TtsProviderType, TtsProviderSettings> {
    const result = { ...configs };
    for (const key of Object.keys(result) as TtsProviderType[]) {
        if (result[key]?.apiKey) {
            result[key] = { ...result[key], apiKey: encryptApiKey(result[key].apiKey!) };
        }
    }
    return result;
}

function decryptProviderConfigs(
    configs: Record<TtsProviderType, TtsProviderSettings>,
): Record<TtsProviderType, TtsProviderSettings> {
    const result = { ...configs };
    for (const key of Object.keys(result) as TtsProviderType[]) {
        if (result[key]?.apiKey) {
            result[key] = { ...result[key], apiKey: decryptApiKey(result[key].apiKey!) };
        }
    }
    return result;
}

function rowToSettings(row: typeof ttsSettings.$inferSelect): TtsSettings {
    const defaults = createDefaultTtsSettings();
    const storedProviders = JSON.parse(row.providerConfigs || '{}');
    const providers = { ...defaults.providers };
    for (const key of Object.keys(storedProviders) as TtsProviderType[]) {
        providers[key] = { ...providers[key], ...storedProviders[key] };
    }

    return {
        activeProvider: row.activeProvider as TtsProviderType,
        fallbackOrder: JSON.parse(row.fallbackOrder),
        highlightMode: row.highlightMode as TtsHighlightMode,
        autoPlay: row.autoPlay,
        rate: row.rate,
        segmentGapMs: row.segmentGapMs ?? 700,
        cacheMaxSizeMb: row.cacheMaxSizeMb,
        providers: decryptProviderConfigs(providers),
    };
}

export function getSettings(): TtsSettings | null {
    const row = getDb().select().from(ttsSettings).get();
    if (!row) return null;
    return rowToSettings(row);
}

export function ensureSettings(): TtsSettings {
    const existing = getSettings();
    if (existing) return existing;

    const defaults = createDefaultTtsSettings();
    const id = randomUUID();
    getDb()
        .insert(ttsSettings)
        .values({
            id,
            activeProvider: defaults.activeProvider,
            fallbackOrder: JSON.stringify(defaults.fallbackOrder),
            highlightMode: defaults.highlightMode,
            autoPlay: defaults.autoPlay,
            rate: defaults.rate,
            segmentGapMs: defaults.segmentGapMs,
            cacheMaxSizeMb: defaults.cacheMaxSizeMb,
            providerConfigs: JSON.stringify(encryptProviderConfigs(defaults.providers)),
        })
        .run();
    return getSettings()!;
}

export function updateSettings(partial: Partial<TtsSettings>): void {
    const current = ensureSettings();
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (partial.activeProvider !== undefined) update.activeProvider = partial.activeProvider;
    if (partial.fallbackOrder !== undefined)
        update.fallbackOrder = JSON.stringify(partial.fallbackOrder);
    if (partial.highlightMode !== undefined) update.highlightMode = partial.highlightMode;
    if (partial.autoPlay !== undefined) update.autoPlay = partial.autoPlay;
    if (partial.rate !== undefined) update.rate = partial.rate;
    if (partial.segmentGapMs !== undefined) update.segmentGapMs = partial.segmentGapMs;
    if (partial.cacheMaxSizeMb !== undefined) update.cacheMaxSizeMb = partial.cacheMaxSizeMb;
    if (partial.providers !== undefined) {
        const merged = { ...current.providers };
        for (const key of Object.keys(partial.providers) as TtsProviderType[]) {
            merged[key] = { ...merged[key], ...partial.providers[key] };
        }
        update.providerConfigs = JSON.stringify(encryptProviderConfigs(merged));
    }

    const row = getDb().select().from(ttsSettings).get();
    if (row) {
        getDb().update(ttsSettings).set(update).where(eq(ttsSettings.id, row.id)).run();
    }
}
