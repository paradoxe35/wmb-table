#!/usr/bin/env node
/**
 * Build Bible SQLite databases from the getbible.net v2 API.
 *
 * Usage:
 *   node scripts/build-bible-db.mjs                  # Build all configured versions
 *   node scripts/build-bible-db.mjs darby kjv        # Build specific versions
 *   node scripts/build-bible-db.mjs --list            # List available versions
 *
 * Local versions are output to resources/database/ (bundled with app).
 * Remote versions are output to build/bibles/ (uploaded to GitHub releases).
 */

import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_BASE = 'https://api.getbible.net/v2';
const LOCAL_DIR = join(__dirname, '..', 'resources', 'database');
const REMOTE_DIR = join(__dirname, '..', 'build', 'bibles');

// ---------------------------------------------------------------------------
// Bible versions to build (PUBLIC DOMAIN only)
// ---------------------------------------------------------------------------
const VERSIONS = {
    // French
    lsg: {
        apiKey: 'ls1910',
        langCode: 'fr',
        name: 'Louis Segond',
        fileName: 'bible.fr-lsg.sqlite',
        distribution: 'local',
    },
    darby: {
        apiKey: 'darby',
        langCode: 'fr',
        name: 'Bible Darby',
        fileName: 'bible.fr-darby.sqlite',
        distribution: 'remote',
    },
    // English
    kjv: {
        apiKey: 'kjv',
        langCode: 'en',
        name: 'King James Version',
        fileName: 'bible.en-kjv.sqlite',
        distribution: 'local',
    },
    asv: {
        apiKey: 'asv',
        langCode: 'en',
        name: 'American Standard Version',
        fileName: 'bible.en-asv.sqlite',
        distribution: 'remote',
    },
    basicenglish: {
        apiKey: 'basicenglish',
        langCode: 'en',
        name: 'Bible in Basic English',
        fileName: 'bible.en-bbe.sqlite',
        distribution: 'remote',
    },
};

// Books 1-39 = Old Testament, 40-66 = New Testament
const isOT = (nr) => nr >= 1 && nr <= 39;

function generateId(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = randomBytes(length);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function bookCode(bookNr) {
    const testament = isOT(bookNr) ? 'O' : 'N';
    return `${String(bookNr).padStart(2, '0')}${testament}`;
}

async function fetchBook(apiKey, bookNr) {
    const url = `${API_BASE}/${apiKey}/${bookNr}.json`;
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'wmb-table-bible-builder/1.0' },
            signal: AbortSignal.timeout(30_000),
        });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        if (err?.name === 'AbortError' || err?.message?.includes('404')) return null;
        console.error(`  Warning: Error fetching book ${bookNr}: ${err.message}`);
        return null;
    }
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function createDatabase(dbPath) {
    if (existsSync(dbPath)) rmSync(dbPath);

    const db = new DatabaseSync(dbPath);

    db.exec(`
        CREATE TABLE bible_verses (
            id TEXT PRIMARY KEY NOT NULL,
            book_name TEXT NOT NULL,
            book TEXT NOT NULL,
            testament TEXT NOT NULL,
            chapter TEXT NOT NULL,
            verse TEXT NOT NULL,
            content TEXT NOT NULL
        )
    `);

    db.exec(`
        CREATE VIRTUAL TABLE bible_verses_fts USING fts5(
            content, book_name, content='bible_verses', content_rowid='rowid',
            tokenize='unicode61'
        )
    `);

    db.exec(`
        CREATE TRIGGER bible_verses_ai AFTER INSERT ON bible_verses BEGIN
            INSERT INTO bible_verses_fts(rowid, content, book_name)
            VALUES (new.rowid, new.content, new.book_name);
        END
    `);

    db.exec(`
        CREATE TRIGGER bible_verses_ad AFTER DELETE ON bible_verses BEGIN
            INSERT INTO bible_verses_fts(bible_verses_fts, rowid, content, book_name)
            VALUES ('delete', old.rowid, old.content, old.book_name);
        END
    `);

    db.exec(`
        CREATE TRIGGER bible_verses_au AFTER UPDATE ON bible_verses BEGIN
            INSERT INTO bible_verses_fts(bible_verses_fts, rowid, content, book_name)
            VALUES ('delete', old.rowid, old.content, old.book_name);
            INSERT INTO bible_verses_fts(rowid, content, book_name)
            VALUES (new.rowid, new.content, new.book_name);
        END
    `);

    return db;
}

function outputDir(config) {
    return config.distribution === 'local' ? LOCAL_DIR : REMOTE_DIR;
}

async function buildVersion(key, config) {
    const dir = outputDir(config);
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, config.fileName);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Building: ${config.name} (${key}) [${config.distribution}]`);
    console.log(`Output:   ${dbPath}`);
    console.log(`${'='.repeat(60)}`);

    const db = createDatabase(dbPath);
    const insert = db.prepare(
        'INSERT INTO bible_verses (id, book_name, book, testament, chapter, verse, content) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );

    let totalVerses = 0;
    let totalBooks = 0;

    for (let bookNr = 1; bookNr <= 66; bookNr++) {
        await sleep(300); // Rate limiting
        const data = await fetchBook(config.apiKey, bookNr);
        if (!data) {
            console.log(`  Warning: Book ${bookNr} not found, skipping`);
            continue;
        }

        const bookName = data.name;
        const code = bookCode(bookNr);
        const testament = isOT(bookNr) ? 'O' : 'N';
        let bookVerses = 0;

        db.exec('BEGIN');
        for (const chapterData of data.chapters ?? []) {
            const chapterNr = String(chapterData.chapter);
            for (const verseData of chapterData.verses ?? []) {
                const verseNr = String(verseData.verse);
                const text = (verseData.text ?? '').trim();
                if (!text) continue;

                insert.run(generateId(), bookName, code, testament, chapterNr, verseNr, text);
                bookVerses++;
            }
        }
        db.exec('COMMIT');

        totalVerses += bookVerses;
        totalBooks++;
        console.log(`  Done: ${bookName.padEnd(20)} (${code}) - ${bookVerses} verses`);
    }

    db.close();

    const sizeMb = (statSync(dbPath).size / (1024 * 1024)).toFixed(1);
    console.log(`\nDone: ${totalBooks} books, ${totalVerses} verses, ${sizeMb} MB`);
    return true;
}

function generateRemoteIndex() {
    const indexPath = join(REMOTE_DIR, 'bible-index.json');
    mkdirSync(REMOTE_DIR, { recursive: true });

    const entries = Object.entries(VERSIONS)
        .filter(([, c]) => c.distribution === 'remote')
        .map(([key, c]) => ({
            langCode: c.langCode,
            abbreviation: key,
            name: c.name,
            fileName: c.fileName,
            type: 'remote',
        }));

    writeFileSync(indexPath, JSON.stringify(entries, null, 4) + '\n');
    console.log(`\nRemote index: ${indexPath} (${entries.length} versions)`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const listFlag = args.includes('--list');
const versionArgs = args.filter((a) => !a.startsWith('--'));

if (listFlag) {
    console.log('Available versions:');
    for (const [key, config] of Object.entries(VERSIONS)) {
        console.log(
            `  ${key.padEnd(15)} ${config.name.padEnd(30)} (${config.langCode}) [${config.distribution}]`,
        );
    }
    process.exit(0);
}

const keysToBuild = versionArgs.length > 0 ? versionArgs : Object.keys(VERSIONS);

for (const key of keysToBuild) {
    if (!(key in VERSIONS)) {
        console.error(`Error: Unknown version '${key}'. Use --list to see available versions.`);
        process.exit(1);
    }
}

const built = [];
for (const key of keysToBuild) {
    if (await buildVersion(key, VERSIONS[key])) {
        built.push(key);
    }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Built ${built.length}/${keysToBuild.length} databases successfully`);
console.log(`${'='.repeat(60)}`);

generateRemoteIndex();
