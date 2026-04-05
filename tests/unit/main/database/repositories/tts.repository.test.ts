import { beforeEach, describe, expect, it } from 'vitest';
import * as ttsRepo from '@main/database/repositories/tts.repository';
import { createTestDb } from '../test-helpers';

describe('tts.repository', () => {
    beforeEach(() => {
        createTestDb();
    });

    it('ensureSettings creates defaults', () => {
        const settings = ttsRepo.ensureSettings();
        expect(settings.activeProvider).toBe('sherpa');
        expect(settings.autoSwitchVoice).toBe(true);
    });

    it('updateSettings returns merged canonical settings', () => {
        ttsRepo.ensureSettings();

        const updated = ttsRepo.updateSettings({
            rate: 1.3,
            providers: {
                openai: {
                    apiKey: 'test-key',
                    voiceId: 'alloy',
                },
            },
        });

        expect(updated.rate).toBe(1.3);
        expect(updated.providers.openai.apiKey).toBe('test-key');
        expect(updated.providers.openai.voiceId).toBe('alloy');
        expect(updated.providers.sherpa).toBeDefined();
    });
});
