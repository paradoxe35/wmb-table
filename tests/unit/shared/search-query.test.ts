import { describe, expect, it } from 'vitest';
import { parseSearchQuery, scoreSearchMatch, searchList } from '@shared/searchable';

const identity = (text: string) => text;

function matches(query: string, text: string): boolean {
    const parsed = parseSearchQuery(query);
    return parsed ? scoreSearchMatch(text, parsed) > 0 : false;
}

function rank(query: string, titles: string[]): string[] {
    return searchList(titles, query, identity);
}

describe('parseSearchQuery', () => {
    it('has nothing to search for in an empty or punctuation-only query', () => {
        expect(parseSearchQuery('')).toBeNull();
        expect(parseSearchQuery('   ')).toBeNull();
        expect(parseSearchQuery('-- ... --')).toBeNull();
    });
});

describe('matching across separators', () => {
    const SAME: [string, string][] = [
        ['suis moi', 'Suis-moi'],
        ['suis-moi', 'Suis moi'],
        ['suis  moi', 'Suis—moi'],
        ['suis, moi', 'Suis moi'],
        ["l'eglise", 'L’Église'],
        ['leglise', "L'Eglise"],
    ];

    it.each(SAME)('finds "%s" in "%s"', (query, title) => {
        expect(matches(query, title)).toBe(true);
    });

    it('does not invent words that are absent', () => {
        expect(matches('suis toi', 'Suis-moi')).toBe(false);
        expect(matches('suis moi seul', 'Suis-moi')).toBe(false);
    });
});

describe('matching regardless of diacritics and case', () => {
    const SAME: [string, string, string][] = [
        ['latin', 'pere', 'Le Père'],
        ['latin', 'PÈRE', 'le pere'],
        ['latin', 'bapteme eau', "Le Baptême d'eau"],
        ['vietnamese', 'nguyen', 'Nguyễn'],
        ['greek', 'αγαπη', 'Ἀγάπη'],
        ['cyrillic', 'иисус', 'Иису́с'],
    ];

    it.each(SAME)('matches %s "%s" against "%s"', (_script, query, title) => {
        expect(matches(query, title)).toBe(true);
    });
});

describe('matching in scripts written without spaces', () => {
    it('matches a Chinese term anywhere, since every character is a word', () => {
        expect(matches('中国', '我住在中国的时候')).toBe(true);
        expect(matches('日本', '我住在中国的时候')).toBe(false);
    });

    it('matches a Thai term inside a run of characters', () => {
        expect(matches('ความรัก', 'พระเจ้าคือความรัก')).toBe(true);
    });
});

describe('search-as-you-type', () => {
    it('matches a term the user has only half typed', () => {
        expect(matches('suis mo', 'Suis-moi')).toBe(true);
        expect(matches('bapt', 'Le Baptême')).toBe(true);
    });

    it('ignores the order the terms were typed in', () => {
        expect(matches('moi suis', 'Suis-moi')).toBe(true);
    });
});

describe('ranking', () => {
    it('puts the title that reads back the query first', () => {
        expect(
            rank('suis moi', [
                'Je te suis, dis-moi pourquoi',
                'Suis-moi et je te ferai',
                'Ce que je poursuis, moi',
                'Le berger dit: suis-moi',
            ]),
        ).toEqual([
            'Suis-moi et je te ferai',
            'Le berger dit: suis-moi',
            'Je te suis, dis-moi pourquoi',
            'Ce que je poursuis, moi',
        ]);
    });

    it('prefers a whole word over the same letters buried inside one', () => {
        expect(rank('foi', ['Parfois il faut attendre', 'Le parfait amour', 'La foi'])).toEqual([
            'La foi',
            'Parfois il faut attendre',
        ]);
    });

    it('keeps the caller order between titles of equal rank', () => {
        const titles = ['Une foi vivante', 'La foi est une ferme assurance'];
        expect(searchList(titles, 'foi', identity)).toEqual(titles);
    });

    it('breaks ties with the comparator it is given', () => {
        const titles = ['Une foi vivante', 'La foi est une ferme assurance'];
        expect(searchList(titles, 'foi', identity, (a, b) => a.localeCompare(b))).toEqual([
            'La foi est une ferme assurance',
            'Une foi vivante',
        ]);
    });
});

describe('reusing one compiled query', () => {
    it('keeps every candidate a stateful matcher would have skipped', () => {
        const titles = ['La foi', 'Une foi', 'Ma foi', 'Sa foi'];
        expect(searchList(titles, 'foi', identity)).toEqual(titles);
    });
});

describe('searching a list', () => {
    it('keeps everything when nothing was typed', () => {
        const titles = ['Une foi vivante', 'La foi'];
        expect(searchList(titles, '', identity)).toEqual(titles);
        expect(searchList(titles, '   ', identity)).toEqual(titles);
    });

    it('orders the untouched list with the tie-break comparator', () => {
        const titles = ['Une foi vivante', 'La foi'];
        expect(searchList(titles, '', identity, (a, b) => a.localeCompare(b))).toEqual([
            'La foi',
            'Une foi vivante',
        ]);
    });

    it('does not mutate the list it was given', () => {
        const titles = ['Une foi vivante', 'La foi'];
        searchList(titles, '', identity, (a, b) => a.localeCompare(b));
        expect(titles).toEqual(['Une foi vivante', 'La foi']);
    });
});
