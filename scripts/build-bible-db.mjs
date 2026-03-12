#!/usr/bin/env node
/**
 * Build Bible SQLite databases from the getbible.net v2 API.
 *
 * Usage:
 *   node scripts/build-bible-db.mjs                  # Build new or changed versions only
 *   node scripts/build-bible-db.mjs darby kjv        # Check & build specific versions
 *   node scripts/build-bible-db.mjs --force           # Rebuild all, ignore existing content
 *   node scripts/build-bible-db.mjs --force darby     # Force rebuild specific versions
 *   node scripts/build-bible-db.mjs --list            # List available versions
 *
 * Local versions are output to resources/database/ (bundled with app).
 * Remote versions are output to build/bibles/ (uploaded to GitHub releases).
 */

import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_BASE = 'https://api.getbible.net/v2';
const LOCAL_DIR = join(__dirname, '..', 'resources', 'database');
const REMOTE_DIR = join(__dirname, '..', 'build', 'bibles');

// ---------------------------------------------------------------------------
// Bible versions to build (OPEN LICENSE only — Public Domain, GPL, GFDL, CC)
// ---------------------------------------------------------------------------
const VERSIONS = {
    // ── French ──
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
    martin: {
        apiKey: 'martin',
        langCode: 'fr',
        name: 'Martin (1744)',
        fileName: 'bible.fr-martin.sqlite',
        distribution: 'remote',
    },

    // ── English ──
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

    // ── Afrikaans ──
    // Note: aov (Ou Vertaling) is copyrighted, no open-license Afrikaans available

    // ── Czech ──
    bkr: {
        apiKey: 'bkr',
        langCode: 'cs',
        name: 'Czech BKR',
        fileName: 'bible.cs-bkr.sqlite',
        distribution: 'remote',
    },

    // ── German ──
    elberfelder: {
        apiKey: 'elberfelder',
        langCode: 'de',
        name: 'Elberfelder (1871)',
        fileName: 'bible.de-elberfelder.sqlite',
        distribution: 'remote',
    },
    elberfelder1905: {
        apiKey: 'elberfelder1905',
        langCode: 'de',
        name: 'Elberfelder (1905)',
        fileName: 'bible.de-elberfelder1905.sqlite',
        distribution: 'remote',
    },
    luther1545: {
        apiKey: 'luther1545',
        langCode: 'de',
        name: 'Luther (1545)',
        fileName: 'bible.de-luther1545.sqlite',
        distribution: 'remote',
    },

    // ── Spanish ──
    rv1858: {
        apiKey: 'rv1858',
        langCode: 'es',
        name: 'Reina Valera NT (1858)',
        fileName: 'bible.es-rv1858.sqlite',
        distribution: 'remote',
    },
    sse: {
        apiKey: 'sse',
        langCode: 'es',
        name: 'Sagradas Escrituras (1569)',
        fileName: 'bible.es-sse.sqlite',
        distribution: 'remote',
    },

    // ── Finnish ──
    finnish1776: {
        apiKey: 'finnish1776',
        langCode: 'fin',
        name: 'Finnish Bible (1776)',
        fileName: 'bible.fin-1776.sqlite',
        distribution: 'remote',
    },
    pyharaamattu1933: {
        apiKey: 'pyharaamattu1933',
        langCode: 'fin',
        name: 'Pyhä Raamattu (1933/1938)',
        fileName: 'bible.fin-pyharaamattu.sqlite',
        distribution: 'remote',
    },

    // ── Croatian ──
    croatia: {
        apiKey: 'croatia',
        langCode: 'hr',
        name: 'Croatian Bible',
        fileName: 'bible.hr-croatia.sqlite',
        distribution: 'remote',
    },

    // ── Hungarian ──
    karoli: {
        apiKey: 'karoli',
        langCode: 'hu',
        name: 'Hungarian Károli',
        fileName: 'bible.hu-karoli.sqlite',
        distribution: 'remote',
    },

    // ── Italian ──
    giovanni: {
        apiKey: 'giovanni',
        langCode: 'it',
        name: 'Giovanni Diodati (1649)',
        fileName: 'bible.it-giovanni.sqlite',
        distribution: 'remote',
    },
    riveduta: {
        apiKey: 'riveduta',
        langCode: 'it',
        name: 'Riveduta (1927)',
        fileName: 'bible.it-riveduta.sqlite',
        distribution: 'remote',
    },

    // ── Japanese ──
    japbungo: {
        apiKey: 'japbungo',
        langCode: 'ja',
        name: '明治元訳 (Meiji)',
        fileName: 'bible.ja-bungo.sqlite',
        distribution: 'remote',
    },
    japkougo: {
        apiKey: 'japkougo',
        langCode: 'ja',
        name: '口語訳 (Kougo-yaku)',
        fileName: 'bible.ja-kougo.sqlite',
        distribution: 'remote',
    },

    // ── Korean ──
    korean: {
        apiKey: 'korean',
        langCode: 'ko',
        name: '개역성경 (Korean)',
        fileName: 'bible.ko-korean.sqlite',
        distribution: 'remote',
    },

    // ── Malagasy ──
    mg1865: {
        apiKey: 'mg1865',
        langCode: 'mg',
        name: 'Baiboly Malagasy (1865)',
        fileName: 'bible.mg-1865.sqlite',
        distribution: 'remote',
    },

    // ── Burmese ──
    judson: {
        apiKey: 'judson',
        langCode: 'mya',
        name: 'Judson (1835)',
        fileName: 'bible.mya-judson.sqlite',
        distribution: 'remote',
    },

    // ── Ndebele ──
    ndebele: {
        apiKey: 'ndebele',
        langCode: 'nde',
        name: 'Ndebele Bible',
        fileName: 'bible.nde-ndebele.sqlite',
        distribution: 'remote',
    },

    // ── Dutch ──
    canisius: {
        apiKey: 'canisius',
        langCode: 'nl',
        name: 'Petrus Canisius',
        fileName: 'bible.nl-canisius.sqlite',
        distribution: 'remote',
    },
    statenvertaling: {
        apiKey: 'statenvertaling',
        langCode: 'nl',
        name: 'Staten Vertaling',
        fileName: 'bible.nl-statenvertaling.sqlite',
        distribution: 'remote',
    },

    // ── Norwegian ──
    bibelselskap: {
        apiKey: 'bibelselskap',
        langCode: 'nn',
        name: 'Det Norsk Bibelselskap (1930)',
        fileName: 'bible.nn-bibelselskap.sqlite',
        distribution: 'remote',
    },
    norsmb: {
        apiKey: 'norsmb',
        langCode: 'nn',
        name: 'Studentmållagsbibelen (1921)',
        fileName: 'bible.nn-norsmb.sqlite',
        distribution: 'remote',
    },

    // ── Polish ──
    polgdanska: {
        apiKey: 'polgdanska',
        langCode: 'pl',
        name: 'Biblia Gdańska (1881)',
        fileName: 'bible.pl-gdanska.sqlite',
        distribution: 'remote',
    },

    // ── Portuguese ──
    almeida: {
        apiKey: 'almeida',
        langCode: 'pt',
        name: 'Almeida Atualizada',
        fileName: 'bible.pt-almeida.sqlite',
        distribution: 'remote',
    },
    livre: {
        apiKey: 'livre',
        langCode: 'pt',
        name: 'Bíblia Livre',
        fileName: 'bible.pt-livre.sqlite',
        distribution: 'remote',
    },

    // ── Russian ──
    synodal: {
        apiKey: 'synodal',
        langCode: 'ru',
        name: 'Синодальный перевод (1876)',
        fileName: 'bible.ru-synodal.sqlite',
        distribution: 'remote',
    },

    // ── Shona ──
    shona: {
        apiKey: 'shona',
        langCode: 'sna',
        name: 'Shona Bible',
        fileName: 'bible.sna-shona.sqlite',
        distribution: 'remote',
    },

    // ── Serbian ──
    srkdekavski: {
        apiKey: 'srkdekavski',
        langCode: 'sr',
        name: 'Daničić-Karadžić',
        fileName: 'bible.sr-dkekavski.sqlite',
        distribution: 'remote',
    },

    // ── Swedish ──
    swedish: {
        apiKey: 'swedish',
        langCode: 'sv',
        name: 'Swedish (1917)',
        fileName: 'bible.sv-1917.sqlite',
        distribution: 'remote',
    },

    // ── Swahili ──
    swahili: {
        apiKey: 'swahili',
        langCode: 'sw',
        name: 'Swahili Bible',
        fileName: 'bible.sw-swahili.sqlite',
        distribution: 'remote',
    },

    // ── Tagalog ──
    tagalog: {
        apiKey: 'tagalog',
        langCode: 'tl',
        name: 'Ang Dating Biblia (1905)',
        fileName: 'bible.tl-tagalog.sqlite',
        distribution: 'remote',
    },

    // ── Ukrainian ──
    ukrogienko: {
        apiKey: 'ukrogienko',
        langCode: 'ua',
        name: 'Переклад Івана Огієнка',
        fileName: 'bible.ua-ogienko.sqlite',
        distribution: 'remote',
    },

    // ── Vietnamese ──
    vietnamese: {
        apiKey: 'vietnamese',
        langCode: 'vi',
        name: 'Vietnamese (1934)',
        fileName: 'bible.vi-1934.sqlite',
        distribution: 'remote',
    },

    // ── Chinese ──
    chiunl: {
        apiKey: 'chiunl',
        langCode: 'zh',
        name: '聖經 文理和合',
        fileName: 'bible.zh-chiunl.sqlite',
        distribution: 'remote',
    },
    cus: {
        apiKey: 'cus',
        langCode: 'zh',
        name: '和合本 简体 (Union Simplified)',
        fileName: 'bible.zh-cus.sqlite',
        distribution: 'remote',
    },

    // ── Traditional Chinese ──
    cut: {
        apiKey: 'cut',
        langCode: 'zho',
        name: '和合本 繁體 (Union Traditional)',
        fileName: 'bible.zho-cut.sqlite',
        distribution: 'remote',
    },
};

// Books 1-39 = Old Testament, 40-66 = New Testament
const isOT = (nr) => nr >= 1 && nr <= 39;

/**
 * Generate a deterministic ID from the verse coordinates.
 * Same input always produces the same ID → no git diff on rebuild.
 */
function generateId(apiKey, bookCode, chapter, verse) {
    return createHash('sha256')
        .update(`${apiKey}:${bookCode}:${chapter}:${verse}`)
        .digest('base64url')
        .substring(0, 16);
}

function bookCode(bookNr) {
    const testament = isOT(bookNr) ? 'O' : 'N';
    return `${String(bookNr).padStart(2, '0')}${testament}`;
}

async function fetchAvailableBooks(apiKey) {
    const url = `${API_BASE}/${apiKey}/books.json`;
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'wmb-table-bible-builder/1.0' },
            signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) return null;
        const books = await res.json();
        // books is an object keyed by book number
        return Object.keys(books)
            .map(Number)
            .sort((a, b) => a - b);
    } catch {
        return null;
    }
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

/**
 * Compute a content hash from existing DB rows for comparison.
 * Hash covers: id, book, chapter, verse, content (sorted by id for determinism).
 */
function computeExistingHash(dbPath) {
    try {
        const db = new DatabaseSync(dbPath);
        const rows = db
            .prepare('SELECT id, book, chapter, verse, content FROM bible_verses ORDER BY id')
            .all();
        db.close();
        if (rows.length === 0) return null;
        const hash = createHash('sha256');
        for (const r of rows) {
            hash.update(`${r.id}|${r.book}|${r.chapter}|${r.verse}|${r.content}\n`);
        }
        return { hash: hash.digest('hex'), count: rows.length };
    } catch {
        return null;
    }
}

/**
 * Fetch all verses from the API and return them as structured rows.
 */
async function fetchAllVerses(config) {
    const availableBooks = await fetchAvailableBooks(config.apiKey);
    if (!availableBooks || availableBooks.length === 0) return null;

    console.log(`  Found ${availableBooks.length} books available`);
    const rows = [];

    for (const bookNr of availableBooks) {
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

        for (const chapterData of data.chapters ?? []) {
            const chapterNr = String(chapterData.chapter);
            for (const verseData of chapterData.verses ?? []) {
                const verseNr = String(verseData.verse);
                const text = (verseData.text ?? '').trim();
                if (!text) continue;

                const id = generateId(config.apiKey, code, chapterNr, verseNr);
                rows.push({ id, bookName, code, testament, chapterNr, verseNr, text });
                bookVerses++;
            }
        }
        console.log(`  Fetched: ${bookName.padEnd(20)} (${code}) - ${bookVerses} verses`);
    }

    return rows;
}

/**
 * Compute a content hash from fetched API rows (same format as computeExistingHash).
 */
function computeFetchedHash(rows) {
    const hash = createHash('sha256');
    const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
    for (const r of sorted) {
        // Must match computeExistingHash format: id|book|chapter|verse|content
        hash.update(`${r.id}|${r.code}|${r.chapterNr}|${r.verseNr}|${r.text}\n`);
    }
    return hash.digest('hex');
}

async function buildVersion(key, config, force) {
    const dir = outputDir(config);
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, config.fileName);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Checking: ${config.name} (${key}) [${config.distribution}]`);
    console.log(`${'='.repeat(60)}`);

    // Fetch all verses from API
    const apiRows = await fetchAllVerses(config);
    if (!apiRows || apiRows.length === 0) {
        console.log(`  Error: No verses fetched for ${config.apiKey}, skipping`);
        return false;
    }

    // Compare against existing DB (unless --force)
    if (!force && existsSync(dbPath)) {
        const existing = computeExistingHash(dbPath);
        if (existing) {
            const apiHash = computeFetchedHash(apiRows);
            if (existing.hash === apiHash) {
                const sizeMb = (statSync(dbPath).size / (1024 * 1024)).toFixed(1);
                console.log(
                    `  Unchanged: ${config.name} (${key}) — ${existing.count} verses, ${sizeMb} MB. Skipping.`,
                );
                return 'skipped';
            }
            console.log(
                `  Content changed (existing: ${existing.count} verses, API: ${apiRows.length} verses). Rebuilding.`,
            );
        } else {
            console.log(`  Existing DB is empty or corrupt. Rebuilding.`);
        }
    }

    // Write new DB
    console.log(`  Writing: ${dbPath}`);
    const db = createDatabase(dbPath);
    const insert = db.prepare(
        'INSERT INTO bible_verses (id, book_name, book, testament, chapter, verse, content) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );

    db.exec('BEGIN');
    for (const r of apiRows) {
        insert.run(r.id, r.bookName, r.code, r.testament, r.chapterNr, r.verseNr, r.text);
    }
    db.exec('COMMIT');
    db.close();

    const sizeMb = (statSync(dbPath).size / (1024 * 1024)).toFixed(1);
    console.log(`  Built: ${apiRows.length} verses, ${sizeMb} MB`);
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
const forceFlag = args.includes('--force');
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

let built = 0;
let skipped = 0;
for (const key of keysToBuild) {
    const result = await buildVersion(key, VERSIONS[key], forceFlag);
    if (result === 'skipped') skipped++;
    else if (result) built++;
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Done: ${built} built, ${skipped} skipped, ${keysToBuild.length} total`);
console.log(`${'='.repeat(60)}`);

generateRemoteIndex();
