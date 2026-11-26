import Database from 'better-sqlite3';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BIBLE_FTS_SETUP_SQL } from '@main/database/bible-schema';
import type { BibleVersion } from '@main/services/bible.service';

type FixtureVerse = [
    book: string,
    bookName: string,
    chapter: number,
    verse: number,
    content: string,
];

const PSALM_119_VERSES = 60;

const psalm119 = (bookName: string, word: string): FixtureVerse[] =>
    Array.from({ length: PSALM_119_VERSES }, (_, index) => [
        '19O',
        bookName,
        119,
        index + 1,
        `${word} verset ${index + 1}.`,
    ]);

export const FRENCH_VERSES: FixtureVerse[] = [
    ['01O', 'Genèse', 1, 1, 'Au commencement, Dieu créa les cieux et la terre.'],
    ['01O', 'Genèse', 3, 11, "Et l'Éternel Dieu dit : « Qui t'a dit que tu étais nu ? »"],
    ['06O', 'Josué', 1, 9, 'Fortifie-toi et prends courage.'],
    ['18O', 'Job', 1, 1, 'Il y avait dans le pays d’Uts un homme qui s’appelait Job.'],
    ...psalm119('Psaumes', 'Heureux'),
    [
        '43N',
        'Jean',
        3,
        16,
        "Car Dieu a tant aimé le monde qu'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point.",
    ],
    ['43N', 'Jean', 3, 17, "Dieu, en effet, n'a pas envoyé son Fils dans le monde pour juger."],
    ['43N', 'Jean', 3, 18, 'Celui qui croit en lui n’est point jugé.'],
    ['44N', 'Actes', 2, 4, 'Et ils furent tous remplis du Saint-Esprit.'],
    [
        '45N',
        'Romains',
        5,
        5,
        'Car l’amour de Dieu est répandu dans nos cœurs par le Saint-Esprit qui nous a été donné.',
    ],
    ['62N', '1 Jean', 4, 8, "Celui qui n'aime pas n'a pas connu Dieu, car Dieu est amour."],
];

export const ENGLISH_VERSES: FixtureVerse[] = [
    ['01O', 'Genesis', 3, 11, 'And he said, Who told thee that thou wast naked?'],
    ['04O', 'Numbers', 23, 19, 'God is not a man, that he should lie.'],
    ...psalm119('Psalms', 'Blessed'),
    ['43N', 'John', 3, 16, 'For God so loved the world, that he gave his only begotten Son.'],
    ['44N', 'Acts', 2, 4, 'And they were all filled with the Holy Ghost.'],
];

export const FIXTURE_VERSIONS: BibleVersion[] = [
    {
        langCode: 'fr',
        abbreviation: 'lsg',
        name: 'Louis Segond',
        fileName: 'fr-lsg.sqlite',
        type: 'remote',
    },
    {
        langCode: 'en',
        abbreviation: 'kjv',
        name: 'King James',
        fileName: 'en-kjv.sqlite',
        type: 'remote',
    },
    {
        langCode: 'es',
        abbreviation: 'rv',
        name: 'Reina Valera',
        fileName: 'es-rv.sqlite',
        type: 'remote',
    },
];

function writeBible(path: string, verses: FixtureVerse[]): void {
    const db = new Database(path);
    db.exec(`CREATE TABLE bible_verses (
        id TEXT PRIMARY KEY NOT NULL, book_name TEXT NOT NULL, book TEXT NOT NULL,
        testament TEXT NOT NULL, chapter TEXT NOT NULL, verse TEXT NOT NULL, content TEXT NOT NULL
    )`);
    db.exec(BIBLE_FTS_SETUP_SQL);
    const insert = db.prepare(
        'INSERT INTO bible_verses (id, book_name, book, testament, chapter, verse, content) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    for (const [book, bookName, chapter, verse, content] of verses) {
        insert.run(
            `${book}-${chapter}-${verse}`,
            bookName,
            book,
            book.slice(-1),
            String(chapter),
            String(verse),
            content,
        );
    }
    db.close();
}

let fixtureDir: string | null = null;
let activeAbbreviation: string | null = 'lsg';

/** French and English Bibles on disk; the Spanish version is listed but not downloaded. */
export function createBibleFixture(): void {
    fixtureDir = mkdtempSync(join(tmpdir(), 'wmb-bible-fixture-'));
    writeBible(join(fixtureDir, 'fr-lsg.sqlite'), FRENCH_VERSES);
    writeBible(join(fixtureDir, 'en-kjv.sqlite'), ENGLISH_VERSES);
}

export function removeBibleFixture(): void {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
    fixtureDir = null;
}

export function setActiveFixtureVersion(abbreviation: string | null): void {
    activeAbbreviation = abbreviation;
}

const resolveBiblePath = (version: BibleVersion) =>
    join(fixtureDir ?? '/nonexistent', version.fileName);
const isBibleAvailable = (version: BibleVersion) => existsSync(resolveBiblePath(version));

/** Stands in for `@main/services/bible.service`, reading the fixture Bibles. */
export const fakeBibleService = {
    getAllBibleVersions: () => FIXTURE_VERSIONS,
    getBibleVersionsForLanguage: (langCode: string) =>
        FIXTURE_VERSIONS.filter((version) => version.langCode === langCode),
    resolveBiblePath,
    isBibleAvailable,
    getActiveVersion: () =>
        FIXTURE_VERSIONS.find((version) => version.abbreviation === activeAbbreviation) ?? null,
};
