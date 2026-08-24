import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { ttsSettings } from '../schema';
import { SimpleCache } from '@main/lib/simple-cache';
import type {
    TtsHighlightMode,
    TtsLastPosition,
    TtsSettings,
    TtsProviderType,
} from '@shared/tts.types';
import {
    createDefaultTtsSettings,
    DEFAULT_TTS_PROVIDER,
    SEGMENT_GAP_MS,
    TTS_PROVIDER_TYPES,
} from '@shared/tts.types';

// Fixed ID so that all devices share the same row via Google Drive sync.
// Using a deterministic ID ensures INSERT OR REPLACE merges correctly.
const TTS_SETTINGS_ID = 'tts_settings';

// API keys are stored as plain text (not encrypted with safeStorage) because:
// - safeStorage encryption is machine-specific and cannot be decrypted on another device
// - This table is synced across devices via Google Drive (appDataFolder, not publicly accessible)
// - Encrypting would break cross-device sync and force users to re-enter keys on each device

/** Settings outlive the build that wrote them: a renamed provider must not reach the interface. */
function knownProvider(stored: string | null): TtsProviderType {
    return TTS_PROVIDER_TYPES.includes(stored as TtsProviderType)
        ? (stored as TtsProviderType)
        : DEFAULT_TTS_PROVIDER;
}

function rowToSettings(row: typeof ttsSettings.$inferSelect): TtsSettings {
    const defaults = createDefaultTtsSettings();
    let storedProviders: Record<string, Record<string, unknown>> = {};
    try {
        storedProviders = JSON.parse(row.providerConfigs || '{}');
    } catch {
        // Corrupted config — fall back to defaults
    }
    const providers = { ...defaults.providers };
    for (const key of TTS_PROVIDER_TYPES) {
        if (storedProviders[key]) {
            providers[key] = { ...providers[key], ...storedProviders[key] };
        }
    }

    return {
        activeProvider: knownProvider(row.activeProvider),
        highlightMode: row.highlightMode as TtsHighlightMode,
        autoSwitchVoice: row.autoSwitchVoice ?? true,
        rate: row.rate,
        segmentGapMs: row.segmentGapMs ?? SEGMENT_GAP_MS,
        cacheMaxSizeMb: row.cacheMaxSizeMb,
        providers,
        readIntroduction: row.readIntroduction ?? true,
        announceSegmentNumbers: row.announceSegmentNumbers ?? false,
        bibleReadEntireBook: row.bibleReadEntireBook ?? false,
        autoScrollToHighlight: row.autoScrollToHighlight ?? true,
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
    getDb()
        .insert(ttsSettings)
        .values({
            id: TTS_SETTINGS_ID,
            activeProvider: defaults.activeProvider,
            highlightMode: defaults.highlightMode,
            autoSwitchVoice: defaults.autoSwitchVoice,
            rate: defaults.rate,
            segmentGapMs: defaults.segmentGapMs,
            cacheMaxSizeMb: defaults.cacheMaxSizeMb,
            providerConfigs: JSON.stringify(defaults.providers),
        })
        .run();
    return getSettings()!;
}

export function updateSettings(partial: Partial<TtsSettings>): TtsSettings {
    const current = ensureSettings();
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (partial.activeProvider !== undefined) update.activeProvider = partial.activeProvider;
    if (partial.highlightMode !== undefined) update.highlightMode = partial.highlightMode;
    if (partial.autoSwitchVoice !== undefined) update.autoSwitchVoice = partial.autoSwitchVoice;
    if (partial.rate !== undefined) update.rate = partial.rate;
    if (partial.segmentGapMs !== undefined) update.segmentGapMs = partial.segmentGapMs;
    if (partial.cacheMaxSizeMb !== undefined) update.cacheMaxSizeMb = partial.cacheMaxSizeMb;
    if (partial.readIntroduction !== undefined) update.readIntroduction = partial.readIntroduction;
    if (partial.announceSegmentNumbers !== undefined)
        update.announceSegmentNumbers = partial.announceSegmentNumbers;
    if (partial.bibleReadEntireBook !== undefined)
        update.bibleReadEntireBook = partial.bibleReadEntireBook;
    if (partial.autoScrollToHighlight !== undefined)
        update.autoScrollToHighlight = partial.autoScrollToHighlight;
    if (partial.providers !== undefined) {
        const merged = { ...current.providers };
        for (const key of Object.keys(partial.providers) as TtsProviderType[]) {
            merged[key] = { ...merged[key], ...partial.providers[key] };
        }
        update.providerConfigs = JSON.stringify(merged);
    }

    const row = getDb().select().from(ttsSettings).get();
    if (row) {
        getDb().update(ttsSettings).set(update).where(eq(ttsSettings.id, row.id)).run();
    }

    return ensureSettings();
}

const lastPositionCache = new SimpleCache<TtsLastPosition>('tts-last-position');

export function getLastPosition(): TtsLastPosition | null {
    return lastPositionCache.get();
}

export function setLastPosition(position: TtsLastPosition | null): void {
    if (position) {
        lastPositionCache.set(position);
    } else {
        lastPositionCache.remove();
    }
}
