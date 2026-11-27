import { describe, expect, it, vi } from 'vitest';
import { createDefaultAiSettings, type AiSettings } from '@shared/ai.types';
import { createAiSettingsSaveQueue } from '@renderer/stores/ai-settings-save-queue';

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A fake main process: merges like the repository and answers after `latencyMs`. */
function createHarness(latencyMs: number[] = []) {
    let stored: AiSettings = {
        ...createDefaultAiSettings(),
        customProviders: [
            { id: 'lm', name: 'LM', baseUrl: 'http://old/v1', apiKey: 'old', defaultModel: 'm' },
        ],
    };
    let rendererSettings: AiSettings | null = structuredClone(stored);
    const sent: Partial<AiSettings>[] = [];
    let call = 0;
    const queue = createAiSettingsSaveQueue({
        current: () => rendererSettings,
        save: async (partial) => {
            sent.push(partial);
            await delay(latencyMs[call++] ?? 0);
            stored = { ...stored, ...partial };
            return structuredClone(stored);
        },
        applied: (settings) => {
            rendererSettings = settings;
        },
    });
    return {
        queue,
        sent,
        stored: () => stored,
        setRendererSettings: (s: AiSettings | null) => (rendererSettings = s),
    };
}

function editCustom(patch: Partial<AiSettings['customProviders'][number]>) {
    return (current: AiSettings): Partial<AiSettings> => ({
        customProviders: current.customProviders.map((p) => ({ ...p, ...patch })),
    });
}

describe('createAiSettingsSaveQueue', () => {
    it('keeps both fields when two edits of the same provider overlap', async () => {
        const harness = createHarness([30, 0]);

        const first = harness.queue.enqueue(editCustom({ baseUrl: 'http://new/v1' }));
        const second = harness.queue.enqueue(editCustom({ apiKey: 'new' }));
        await Promise.all([first, second]);

        expect(harness.stored().customProviders[0]).toMatchObject({
            baseUrl: 'http://new/v1',
            apiKey: 'new',
        });
    });

    it('runs saves one at a time, in order', async () => {
        const harness = createHarness([20, 0, 0]);

        await Promise.all([
            harness.queue.enqueue({ enabled: true }),
            harness.queue.enqueue({ languagePreference: 'explicit-only' }),
            harness.queue.enqueue({ enabled: false }),
        ]);

        expect(harness.sent).toEqual([
            { enabled: true },
            { languagePreference: 'explicit-only' },
            { enabled: false },
        ]);
        expect(harness.stored()).toMatchObject({
            enabled: false,
            languagePreference: 'explicit-only',
        });
    });

    it('rejects the failed save but still runs the next one', async () => {
        const save = vi
            .fn<(partial: Partial<AiSettings>) => Promise<AiSettings>>()
            .mockRejectedValueOnce(new Error('Duplicate custom provider id'))
            .mockResolvedValueOnce(createDefaultAiSettings());
        const applied = vi.fn();
        const queue = createAiSettingsSaveQueue({
            current: () => createDefaultAiSettings(),
            save,
            applied,
        });

        const failed = queue.enqueue({ enabled: true });
        const next = queue.enqueue({ enabled: false });

        await expect(failed).rejects.toThrow('Duplicate custom provider id');
        await expect(next).resolves.toBeUndefined();
        expect(applied).toHaveBeenCalledTimes(1);
    });

    it('settled() waits for the pending saves and never rejects', async () => {
        const harness = createHarness([20]);
        void harness.queue.enqueue({ enabled: true }).catch(() => undefined);

        await harness.queue.settled();

        expect(harness.stored().enabled).toBe(true);
    });

    it('skips an updater while settings are not loaded yet', async () => {
        const harness = createHarness();
        harness.setRendererSettings(null);

        await harness.queue.enqueue(editCustom({ apiKey: 'x' }));

        expect(harness.sent).toEqual([]);
    });
});
