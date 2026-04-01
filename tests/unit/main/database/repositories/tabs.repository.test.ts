import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as tabsRepo from '@main/database/repositories/tabs.repository';
import { getDb } from '@main/database';
import { tabs as tabsTable } from '@main/database/schema';
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
            { title: 'Tab 1', documentId: 's1', active: true, scrollY: 100 },
            { title: 'Tab 2', documentId: 's2', active: false },
        ];
        tabsRepo.saveTabs(LANG, tabs);
        const result = tabsRepo.getTabs(LANG);
        expect(result).toHaveLength(2);
        expect(result[0].title).toBe('Tab 1');
        expect(result[0].documentId).toBe('s1');
        expect(result[0].scrollY).toBe(100);
    });

    it('saveTabs overwrites previous data', () => {
        tabsRepo.saveTabs(LANG, [{ title: 'Old', documentId: 's1', active: true }]);
        tabsRepo.saveTabs(LANG, [{ title: 'New', documentId: 's2', active: true }]);
        const result = tabsRepo.getTabs(LANG);
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('New');
    });

    it('normalizes legacy persisted sermonId into documentId', () => {
        getDb()
            .insert(tabsTable)
            .values({
                id: `tabs-${LANG}`,
                languageCode: LANG,
                datas: JSON.stringify([{ title: 'Legacy', sermonId: 'legacy-1', active: true }]),
            })
            .run();
        const result = tabsRepo.getTabs(LANG);
        expect(result[0].documentId).toBe('legacy-1');
    });
});
