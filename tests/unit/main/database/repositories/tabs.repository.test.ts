import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as tabsRepo from '@main/database/repositories/tabs.repository';
import type { DocumentTab } from '@shared/types';

describe('tabs.repository', () => {
    beforeEach(() => {
        createTestDb();
    });

    const LANG = 'en';

    it('getTabs returns empty array initially', () => {
        expect(tabsRepo.getTabs(LANG)).toEqual([]);
    });

    it('saveTabs and getTabs round-trip', () => {
        const tabs: DocumentTab[] = [
            { title: 'Tab 1', sermonId: 's1', active: true, scrollY: 100 },
            { title: 'Tab 2', sermonId: 's2', active: false },
        ];
        tabsRepo.saveTabs(LANG, tabs);
        const result = tabsRepo.getTabs(LANG);
        expect(result).toHaveLength(2);
        expect(result[0].title).toBe('Tab 1');
        expect(result[0].scrollY).toBe(100);
    });

    it('saveTabs overwrites previous data', () => {
        tabsRepo.saveTabs(LANG, [{ title: 'Old', sermonId: 's1', active: true }]);
        tabsRepo.saveTabs(LANG, [{ title: 'New', sermonId: 's2', active: true }]);
        const result = tabsRepo.getTabs(LANG);
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('New');
    });
});
