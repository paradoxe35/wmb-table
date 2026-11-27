import { describe, expect, it } from 'vitest';
import { canDisplayFeatureReminders } from '@renderer/lib/feature-reminders';

describe('feature reminders visibility', () => {
    const baseInput = {
        hydrated: true,
        backendLoaded: true,
        loaded: true,
        syncing: false,
        readingMode: false,
        aiChatInUse: false,
        hasInteracted: true,
        sessionDelayElapsed: true,
        sessionHiddenUntil: null,
        contentLanguage: 'fr',
        now: 1_000,
    };

    it('returns false when content language is not set', () => {
        expect(canDisplayFeatureReminders({ ...baseInput, contentLanguage: null })).toBe(false);
    });

    it('returns true when content language is set and other conditions are met', () => {
        expect(canDisplayFeatureReminders(baseInput)).toBe(true);
    });

    it('waits while the assistant is answering or its chat is open', () => {
        expect(canDisplayFeatureReminders({ ...baseInput, aiChatInUse: true })).toBe(false);
    });
});
