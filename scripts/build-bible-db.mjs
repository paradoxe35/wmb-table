#!/usr/bin/env node
/**
 * Build Bible SQLite databases from the getbible.net v2 API.
 *
 * Usage:
 *   node scripts/build-bible-db.mjs                  # Build & verify all versions
 *   node scripts/build-bible-db.mjs darby kjv        # Build & verify specific versions
 *   node scripts/build-bible-db.mjs --force           # Delete & rebuild all from scratch
 *   node scripts/build-bible-db.mjs --force darby     # Force rebuild specific versions
 *   node scripts/build-bible-db.mjs --list            # List available versions
 *
 * Local versions are output to resources/database/ (bundled with app).
 * Remote versions are output to build/bibles/ (uploaded to GitHub releases).
 *
 * Integrity: each verse gets a deterministic ID (SHA-256 of apiKey:book:chapter:verse).
 * On re-run, existing DBs are verified row-by-row: missing verses are inserted,
 * corrupted content is overwritten, orphan rows (old IDs, duplicates) are deleted.
 * Up to 5 versions are processed in parallel.
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
const CONCURRENCY = 5;

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isOT = (nr) => nr >= 1 && nr <= 39;

/**
 * Deterministic ID from verse coordinates.
 * Same input → same ID, always. No randomness.
 */
function generateId(apiKey, book, chapter, verse) {
    return createHash('sha256')
        .update(`${apiKey}:${book}:${chapter}:${verse}`)
        .digest('base64url')
        .substring(0, 16);
}

function bookCode(bookNr) {
    const testament = isOT(bookNr) ? 'O' : 'N';
    return `${String(bookNr).padStart(2, '0')}${testament}`;
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function outputDir(config) {
    return config.distribution === 'local' ? LOCAL_DIR : REMOTE_DIR;
}

// ---------------------------------------------------------------------------
// API fetching
// ---------------------------------------------------------------------------

async function fetchAvailableBooks(apiKey) {
    const url = `${API_BASE}/${apiKey}/books.json`;
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'wmb-table-bible-builder/1.0' },
            signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) return null;
        const books = await res.json();
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

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

function createFreshDatabase(dbPath) {
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

/**
 * Open existing DB if valid, otherwise create fresh.
 */
function openOrCreateDatabase(dbPath) {
    if (existsSync(dbPath)) {
        try {
            const db = new DatabaseSync(dbPath);
            // Verify schema is intact
            db.prepare('SELECT id, content FROM bible_verses LIMIT 1').get();
            return { db, isNew: false };
        } catch {
            console.log(`  Existing DB is corrupt, recreating from scratch.`);
            rmSync(dbPath);
        }
    }
    return { db: createFreshDatabase(dbPath), isNew: true };
}

// ---------------------------------------------------------------------------
// Build a single version
// ---------------------------------------------------------------------------

async function buildVersion(key, config, force) {
    const dir = outputDir(config);
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, config.fileName);

    const label = `${config.name} (${key})`;
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${label} [${config.distribution}]`);
    console.log(`${'─'.repeat(60)}`);

    // 1. Fetch available books from API
    const availableBooks = await fetchAvailableBooks(config.apiKey);
    if (!availableBooks || availableBooks.length === 0) {
        console.log(`  ✗ Could not fetch book list for "${config.apiKey}", skipping.`);
        return 'error';
    }
    console.log(`  ${availableBooks.length} books available from API`);

    // 2. Fetch all verses from API
    const apiVerses = [];
    for (const bookNr of availableBooks) {
        await sleep(200);
        const data = await fetchBook(config.apiKey, bookNr);
        if (!data) continue;

        const bookName = data.name;
        const code = bookCode(bookNr);
        const testament = isOT(bookNr) ? 'O' : 'N';

        for (const ch of data.chapters ?? []) {
            const chapter = String(ch.chapter);
            for (const v of ch.verses ?? []) {
                const verse = String(v.verse);
                const text = (v.text ?? '').trim();
                if (!text) continue;
                const id = generateId(config.apiKey, code, chapter, verse);
                apiVerses.push({ id, bookName, code, testament, chapter, verse, text });
            }
        }
    }

    if (apiVerses.length === 0) {
        console.log(`  ✗ No verses fetched, skipping.`);
        return 'error';
    }
    console.log(`  ${apiVerses.length} verses fetched from API`);

    // 3. Check for duplicate IDs in API data (should never happen with deterministic IDs)
    const idSet = new Set();
    for (const v of apiVerses) {
        if (idSet.has(v.id)) {
            console.error(
                `  ✗ DUPLICATE ID detected: ${v.id} (${v.code} ${v.chapter}:${v.verse}). Aborting.`,
            );
            return 'error';
        }
        idSet.add(v.id);
    }

    // 4. Force mode: delete and rebuild from scratch
    if (force && existsSync(dbPath)) {
        rmSync(dbPath);
    }

    // 5. Open or create DB
    const { db, isNew } = openOrCreateDatabase(dbPath);

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let deleted = 0;

    if (isNew) {
        // Fresh DB: bulk insert all verses
        const insertStmt = db.prepare(
            'INSERT INTO bible_verses (id, book_name, book, testament, chapter, verse, content) VALUES (?, ?, ?, ?, ?, ?, ?)',
        );
        db.exec('BEGIN');
        for (const v of apiVerses) {
            insertStmt.run(v.id, v.bookName, v.code, v.testament, v.chapter, v.verse, v.text);
        }
        db.exec('COMMIT');
        inserted = apiVerses.length;
    } else {
        // Existing DB: row-by-row verification
        const selectStmt = db.prepare(
            'SELECT book_name, book, testament, chapter, verse, content FROM bible_verses WHERE id = ?',
        );
        const insertStmt = db.prepare(
            'INSERT INTO bible_verses (id, book_name, book, testament, chapter, verse, content) VALUES (?, ?, ?, ?, ?, ?, ?)',
        );
        const updateStmt = db.prepare(
            'UPDATE bible_verses SET book_name = ?, book = ?, testament = ?, chapter = ?, verse = ?, content = ? WHERE id = ?',
        );

        db.exec('BEGIN');
        for (const v of apiVerses) {
            const existing = selectStmt.get(v.id);
            if (!existing) {
                // Missing verse → insert
                insertStmt.run(v.id, v.bookName, v.code, v.testament, v.chapter, v.verse, v.text);
                inserted++;
            } else if (
                existing.content !== v.text ||
                existing.book_name !== v.bookName ||
                existing.book !== v.code ||
                existing.testament !== v.testament ||
                existing.chapter !== v.chapter ||
                existing.verse !== v.verse
            ) {
                // Corrupted or changed → overwrite
                updateStmt.run(v.bookName, v.code, v.testament, v.chapter, v.verse, v.text, v.id);
                updated++;
            } else {
                unchanged++;
            }
        }

        // Remove orphan rows (old random IDs, duplicates, anything not from API)
        const allDbIds = db.prepare('SELECT id FROM bible_verses').all();
        const validIds = idSet;
        const deleteStmt = db.prepare('DELETE FROM bible_verses WHERE id = ?');
        for (const row of allDbIds) {
            if (!validIds.has(row.id)) {
                deleteStmt.run(row.id);
                deleted++;
            }
        }

        db.exec('COMMIT');
    }

    // 6. Integrity check: verify final verse count matches API
    const finalCount = db.prepare('SELECT COUNT(*) as cnt FROM bible_verses').get().cnt;
    db.close();

    if (finalCount !== apiVerses.length) {
        console.error(
            `  ✗ INTEGRITY ERROR: DB has ${finalCount} verses but API has ${apiVerses.length}. DB may be corrupted.`,
        );
        return 'error';
    }

    const sizeMb = (statSync(dbPath).size / (1024 * 1024)).toFixed(1);

    if (isNew) {
        console.log(`  ✓ Created: ${inserted} verses, ${sizeMb} MB`);
    } else if (inserted === 0 && updated === 0 && deleted === 0) {
        console.log(`  ✓ Verified: ${unchanged} verses accurate, ${sizeMb} MB`);
    } else {
        console.log(
            `  ✓ Synced: +${inserted} inserted, ~${updated} fixed, -${deleted} orphans removed, ${unchanged} ok, ${sizeMb} MB`,
        );
    }

    return inserted === 0 && updated === 0 && deleted === 0 && !isNew ? 'unchanged' : 'built';
}

// ---------------------------------------------------------------------------
// Parallel runner — process up to CONCURRENCY versions at a time
// ---------------------------------------------------------------------------

async function runParallel(keys, force) {
    let built = 0;
    let unchangedCount = 0;
    let errors = 0;

    for (let i = 0; i < keys.length; i += CONCURRENCY) {
        const batch = keys.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
            batch.map((key) => buildVersion(key, VERSIONS[key], force)),
        );
        for (const r of results) {
            if (r === 'built') built++;
            else if (r === 'unchanged') unchangedCount++;
            else if (r === 'error') errors++;
        }
    }

    return { built, unchanged: unchangedCount, errors };
}

// ---------------------------------------------------------------------------
// Remote index
// ---------------------------------------------------------------------------

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
            `  ${key.padEnd(20)} ${config.name.padEnd(35)} (${config.langCode}) [${config.distribution}]`,
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

console.log(`Processing ${keysToBuild.length} versions (${CONCURRENCY} in parallel)...`);
const { built, unchanged, errors } = await runParallel(keysToBuild, forceFlag);

console.log(`\n${'='.repeat(60)}`);
console.log(
    `Done: ${built} built, ${unchanged} unchanged, ${errors} errors, ${keysToBuild.length} total`,
);
console.log(`${'='.repeat(60)}`);

generateRemoteIndex();
