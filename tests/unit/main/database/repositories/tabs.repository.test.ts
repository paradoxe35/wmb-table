import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as tabsRepo from '@main/database/repositories/tabs.repository';
import type { DocumentTab } from '@shared/types';

describe('tabs.repository', () => {
    beforeEach(() => {
        createTestDb();
    });

    it('getTabs returns empty array initially', () => {
        expect(tabsRepo.getTabs()).toEqual([]);
    });

    it('saveTabs and getTabs round-trip', () => {
        const tabs: DocumentTab[] = [
            { title: 'Tab 1', active: true, scrollY: 100 },
            { title: 'Tab 2', active: false },
        ];
        tabsRepo.saveTabs(tabs);
        const result = tabsRepo.getTabs();
        expect(result).toHaveLength(2);
        expect(result[0].title).toBe('Tab 1');
        expect(result[0].scrollY).toBe(100);
    });

    it('saveTabs overwrites previous data', () => {
        tabsRepo.saveTabs([{ title: 'Old', active: true }]);
        tabsRepo.saveTabs([{ title: 'New', active: true }]);
        const result = tabsRepo.getTabs();
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('New');
    });
});
