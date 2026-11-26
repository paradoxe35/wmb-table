import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultAiSettings, type AiSettings } from '@shared/ai.types';

vi.mock('@renderer/lib/feature-reminders', () => ({ markFeatureReminderUsed: vi.fn() }));

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function createStoredSettings(): AiSettings {
    return {
        ...createDefaultAiSettings(),
        activeProvider: 'lm',
        customProviders: [
            { id: 'lm', name: 'LM', baseUrl: 'http://old/v1', apiKey: 'old', defaultModel: 'm' },
        ],
    };
}

async function loadStore(updateSettings: (partial: Partial<AiSettings>) => Promise<AiSettings>) {
    vi.resetModules();
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { api: { ai: { updateSettings } }, dispatchEvent });
    const { useAiChatStore } = await import('@renderer/stores/ai-chat.store');
    useAiChatStore.setState({ settings: createStoredSettings() });
    return { store: useAiChatStore, dispatchEvent };
}

describe('ai chat store settings saves', () => {
    let stored: AiSettings;

    beforeEach(() => {
        stored = createStoredSettings();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('keeps two quick edits to different fields of a custom provider', async () => {
        const latency = [40, 0];
        const { store } = await loadStore(async (partial) => {
            await delay(latency.shift() ?? 0);
            stored = { ...stored, ...partial };
            return structuredClone(stored);
        });
        const edit =
            (patch: object) =>
            (current: AiSettings): Partial<AiSettings> => ({
                customProviders: current.customProviders.map((p) => ({ ...p, ...patch })),
            });

        await Promise.all([
            store.getState().saveSettings(edit({ baseUrl: 'http://new/v1' })),
            store.getState().saveSettings(edit({ apiKey: 'new' })),
        ]);

        expect(stored.customProviders[0]).toMatchObject({
            baseUrl: 'http://new/v1',
            apiKey: 'new',
        });
        expect(store.getState().settings?.customProviders[0]).toMatchObject({
            baseUrl: 'http://new/v1',
            apiKey: 'new',
        });
    });

    it('rejects a failed save and keeps the last saved settings', async () => {
        const { store, dispatchEvent } = await loadStore(async () => {
            throw new Error('Invalid base URL');
        });

        await expect(store.getState().saveSettings({ enabled: true })).rejects.toThrow(
            'Invalid base URL',
        );
        expect(store.getState().settings?.enabled).toBe(false);
        expect(dispatchEvent).not.toHaveBeenCalled();
    });

    it('whenSettingsSaved resolves after the pending save is applied', async () => {
        const { store } = await loadStore(async (partial) => {
            await delay(20);
            return { ...stored, ...partial };
        });

        void store.getState().saveSettings({ enabled: true });
        await store.getState().whenSettingsSaved();

        expect(store.getState().settings?.enabled).toBe(true);
    });
});
