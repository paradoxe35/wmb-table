import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as configRepo from '@main/database/repositories/config.repository';

describe('config.repository', () => {
    beforeEach(() => {
        createTestDb();
    });

    it('returns null when no config exists', () => {
        expect(configRepo.getConfig()).toBeNull();
    });

    it('ensureConfig creates a config row', () => {
        const config = configRepo.ensureConfig();
        expect(config.app_id).toBeTruthy();
        expect(config.initialized).toBe(false);
    });

    it('ensureConfig is idempotent', () => {
        const c1 = configRepo.ensureConfig();
        const c2 = configRepo.ensureConfig();
        expect(c1.id).toBe(c2.id);
    });

    it('markInitialized sets initialized to true', () => {
        configRepo.markInitialized();
        const config = configRepo.getConfig();
        expect(config?.initialized).toBe(true);
    });
});
