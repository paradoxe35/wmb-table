import type { AiSettings } from '@shared/ai.types';

/** A patch, or a function that builds the patch from the settings as they are when it runs. */
export type AiSettingsUpdate = Partial<AiSettings> | ((current: AiSettings) => Partial<AiSettings>);

interface SaveQueueDeps {
    current: () => AiSettings | null;
    save: (partial: Partial<AiSettings>) => Promise<AiSettings>;
    applied: (settings: AiSettings) => void;
}

export interface AiSettingsSaveQueue {
    enqueue(update: AiSettingsUpdate): Promise<void>;
    settled(): Promise<void>;
}

/**
 * Runs saves one at a time and builds each patch from the latest saved settings, so a slow
 * save can never send an older value of a field that a later save already changed.
 */
export function createAiSettingsSaveQueue(deps: SaveQueueDeps): AiSettingsSaveQueue {
    let tail: Promise<void> = Promise.resolve();

    async function run(update: AiSettingsUpdate): Promise<void> {
        const current = deps.current();
        const partial = typeof update === 'function' ? current && update(current) : update;
        if (!partial) return;
        deps.applied(await deps.save(partial));
    }

    return {
        enqueue(update) {
            const next = tail.then(() => run(update));
            tail = next.catch(() => undefined);
            return next;
        },
        settled() {
            return tail;
        },
    };
}
