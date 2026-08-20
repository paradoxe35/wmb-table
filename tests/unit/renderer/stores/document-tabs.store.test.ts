import { beforeEach, describe, expect, it } from 'vitest';
import type { DocumentTab } from '@shared/types';
import { clampTabsToLimit, useDocumentTabsStore } from '@renderer/stores';

beforeEach(() => {
    useDocumentTabsStore.setState({
        tabs: [],
        pendingNavigation: null,
    });
});

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

    it('deduplicates sermon tabs when switching inline to an already open translation', () => {
        useDocumentTabsStore.setState({
            tabs: [
                {
                    type: 'sermon',
                    title: 'Current translation',
                    documentId: '63-0825E',
                    translationId: 1,
                    languageCode: 'fr',
                    active: true,
                    scrollY: 0.6,
                },
                {
                    type: 'sermon',
                    title: 'Target translation',
                    documentId: '63-0825E',
                    translationId: 2,
                    languageCode: 'fr',
                    active: false,
                    scrollY: 0.2,
                },
            ],
            pendingNavigation: null,
        });

        useDocumentTabsStore.getState().updateSermonTab('sermon:63-0825E:1:fr', {
            title: 'Target translation',
            documentId: '63-0825E',
            translationId: 2,
            languageCode: 'fr',
        });

        const tabs = useDocumentTabsStore.getState().tabs;

        expect(tabs).toHaveLength(1);
        expect(tabs[0]).toMatchObject({
            type: 'sermon',
            documentId: '63-0825E',
            translationId: 2,
            languageCode: 'fr',
            active: true,
            scrollY: 0.2,
        });
    });

    it('clears sermon scroll when switching inline so the saved position can restore', () => {
        useDocumentTabsStore.setState({
            tabs: [
                {
                    type: 'sermon',
                    title: 'Current translation',
                    documentId: '63-0825E',
                    translationId: 1,
                    languageCode: 'fr',
                    active: true,
                    scrollY: 0.75,
                    scrollX: 0.1,
                },
            ],
            pendingNavigation: null,
        });

        useDocumentTabsStore.getState().updateSermonTab('sermon:63-0825E:1:fr', {
            title: 'Next translation',
            documentId: '63-0825E',
            translationId: 2,
            languageCode: 'fr',
        });

        const switchedTab = useDocumentTabsStore.getState().tabs[0];
        expect(switchedTab).toMatchObject({ translationId: 2 });
        expect(switchedTab.scrollY).toBeUndefined();
        expect(switchedTab.scrollX).toBeUndefined();
    });

    it('deduplicates bible tabs when switching inline to an already open chapter', () => {
        useDocumentTabsStore.setState({
            tabs: [
                {
                    type: 'bible',
                    title: 'Luke 1 (KJV)',
                    documentId: 'LUK:1',
                    bibleBook: 'LUK',
                    bibleChapter: '1',
                    bibleVersionAbbreviation: 'kjv',
                    active: true,
                    scrollY: 0.5,
                },
                {
                    type: 'bible',
                    title: 'Luke 2 (KJV)',
                    documentId: 'LUK:2',
                    bibleBook: 'LUK',
                    bibleChapter: '2',
                    bibleVersionAbbreviation: 'kjv',
                    active: false,
                    scrollY: 0.3,
                },
            ],
            pendingNavigation: null,
        });

        useDocumentTabsStore.getState().updateBibleTab('bible:LUK:1:kjv', {
            title: 'Luke 2 (KJV)',
            documentId: 'LUK:2',
            bibleBook: 'LUK',
            bibleChapter: '2',
            bibleVersionAbbreviation: 'kjv',
        });

        const tabs = useDocumentTabsStore.getState().tabs;

        expect(tabs).toHaveLength(1);
        expect(tabs[0]).toMatchObject({
            type: 'bible',
            documentId: 'LUK:2',
            active: true,
            scrollY: 0.3,
        });
    });
});
