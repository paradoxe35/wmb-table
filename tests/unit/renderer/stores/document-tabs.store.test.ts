import { describe, expect, it } from 'vitest';
import type { DocumentTab } from '@shared/types';
import { clampTabsToLimit } from '@renderer/stores';

describe('document-tabs.store', () => {
    it('keeps the active tab when trimming to the limit', () => {
        const tabs: DocumentTab[] = [
            {
                type: 'sermon',
                title: 'Sermon 1',
                documentId: 's1',
                translationId: 1,
                languageCode: 'fr',
                active: false,
            },
            {
                type: 'sermon',
                title: 'Sermon 2',
                documentId: 's2',
                translationId: 1,
                languageCode: 'fr',
                active: true,
            },
            {
                type: 'custom',
                title: 'Custom',
                documentId: 'c1',
                active: false,
            },
        ];

        const keptTabs = clampTabsToLimit(tabs, 2);

        expect(keptTabs).toHaveLength(2);
        expect(keptTabs[0].documentId).toBe('s2');
        expect(keptTabs[0].active).toBe(true);
    });

    it('activates the last kept tab when trimming removes the active one', () => {
        const tabs: DocumentTab[] = [
            {
                type: 'sermon',
                title: 'Sermon 1',
                documentId: 's1',
                translationId: 1,
                languageCode: 'fr',
                active: true,
            },
            {
                type: 'sermon',
                title: 'Sermon 2',
                documentId: 's2',
                translationId: 1,
                languageCode: 'fr',
                active: false,
            },
            {
                type: 'custom',
                title: 'Custom',
                documentId: 'c1',
                active: false,
            },
        ];

        const keptTabs = clampTabsToLimit(tabs, 2);

        expect(keptTabs).toHaveLength(2);
        expect(keptTabs[1].documentId).toBe('c1');
        expect(keptTabs[1].active).toBe(true);
    });
});
