import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as configRepo from '@main/database/repositories/config.repository';
import { DEFAULT_MAX_TABS, MAX_MAX_TABS, MIN_MAX_TABS } from '@shared/constants';

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
        expect(config.activeBibleVersionAbbreviation).toBeNull();
        expect(config.sidebarHidden).toBe(false);
        expect(config.maxTabs).toBe(DEFAULT_MAX_TABS);
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

    it('persists the active Bible version abbreviation', () => {
        configRepo.ensureConfig();

        configRepo.setActiveBibleVersionAbbreviation('lsg');

        expect(configRepo.getActiveBibleVersionAbbreviation()).toBe('lsg');
        expect(configRepo.getConfig()?.activeBibleVersionAbbreviation).toBe('lsg');
    });

    it('clamps max tabs and returns the saved value', () => {
        configRepo.ensureConfig();

        expect(configRepo.setMaxTabs(MIN_MAX_TABS - 10)).toBe(MIN_MAX_TABS);
        expect(configRepo.getMaxTabs()).toBe(MIN_MAX_TABS);

        expect(configRepo.setMaxTabs(MAX_MAX_TABS + 10)).toBe(MAX_MAX_TABS);
        expect(configRepo.getMaxTabs()).toBe(MAX_MAX_TABS);
    });

    it('persists sidebar hidden state in configuration', () => {
        expect(configRepo.getSidebarStatus()).toBeNull();

        configRepo.setSidebarStatus(true);
        expect(configRepo.getSidebarStatus()).toEqual({ hidden: true });
        expect(configRepo.getConfig()?.sidebarHidden).toBe(true);

        configRepo.setSidebarStatus(false);
        expect(configRepo.getSidebarStatus()).toEqual({ hidden: false });
        expect(configRepo.getConfig()?.sidebarHidden).toBe(false);
    });
});
