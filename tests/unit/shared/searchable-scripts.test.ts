import { describe, expect, it } from 'vitest';
import {
    getHighlightRanges,
    matchesQuery,
    paragraphContainsAllWords,
    tokenizeQuery,
} from '@shared/searchable';

/** The app ships sermons in many languages; search must not be Latin-only. */
const SCRIPTS: { script: string; query: string; text: string }[] = [
    { script: 'french', query: 'Bapteme', text: 'Le Baptême du Saint-Esprit' },
    { script: 'french', query: "l'Agneau", text: 'Voici l’Agneau de Dieu' },
    { script: 'swahili', query: "ng'ombe", text: 'Ni ng’ombe wangu' },
    { script: 'swahili', query: 'Mungu', text: 'Mungu ni upendo' },
    { script: 'chinese', query: '恩典', text: '神的恩典够我用' },
    { script: 'russian', query: 'Иисус', text: 'Иисус Христос воскрес' },
    { script: 'russian', query: 'Иисус', text: 'Иису́с Христо́с' },
    { script: 'greek', query: 'αγαπη', text: 'ἡ ἀγάπη τοῦ Θεοῦ' },
    { script: 'vietnamese', query: 'Nguyen', text: 'Anh Nguyễn' },
];

describe('search across scripts', () => {
    it.each(SCRIPTS)('tokenizes $script "$query"', ({ query }) => {
        expect(tokenizeQuery(query, 'exact').length).toBeGreaterThan(0);
    });

    it.each(SCRIPTS)('matches $script "$query" in "$text"', ({ query, text }) => {
        expect(matchesQuery(text, query, 'exact')).toBe(true);
        expect(paragraphContainsAllWords(text, query, 'all')).toBe(true);
    });

    it.each(SCRIPTS)('highlights $script "$query" in "$text"', ({ query, text }) => {
        expect(getHighlightRanges(text, query, 'exact').length).toBeGreaterThan(0);
    });

    it('still refuses a term the paragraph does not contain', () => {
        expect(matchesQuery('神的恩典够我用', '审判', 'exact')).toBe(false);
        expect(matchesQuery('Иисус Христос', 'Моисей', 'exact')).toBe(false);
        expect(matchesQuery('La foi vient de Dieu', 'resurrection', 'exact')).toBe(false);
    });

    it('keeps whole-word matching rather than matching inside a longer word', () => {
        expect(matchesQuery('Le baptistère est ancien', 'baptiste', 'all')).toBe(false);
        expect(matchesQuery('Le baptiste est venu', 'baptiste', 'all')).toBe(true);
    });

    it('treats an apostrophe as a separator whichever style is typed', () => {
        expect(tokenizeQuery("l'Agneau", 'exact')).toEqual(['l', 'Agneau']);
        expect(tokenizeQuery('l’Agneau', 'exact')).toEqual(['l', 'Agneau']);
    });
});
