import { existsSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

function createSchema(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS bible_verses (
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
        CREATE VIRTUAL TABLE IF NOT EXISTS bible_verses_fts USING fts5(
            content, book_name, content='bible_verses', content_rowid='rowid',
            tokenize='unicode61'
        )
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS bible_verses_ai AFTER INSERT ON bible_verses BEGIN
            INSERT INTO bible_verses_fts(rowid, content, book_name)
            VALUES (new.rowid, new.content, new.book_name);
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS bible_verses_ad AFTER DELETE ON bible_verses BEGIN
            INSERT INTO bible_verses_fts(bible_verses_fts, rowid, content, book_name)
            VALUES ('delete', old.rowid, old.content, old.book_name);
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS bible_verses_au AFTER UPDATE ON bible_verses BEGIN
            INSERT INTO bible_verses_fts(bible_verses_fts, rowid, content, book_name)
            VALUES ('delete', old.rowid, old.content, old.book_name);
            INSERT INTO bible_verses_fts(rowid, content, book_name)
            VALUES (new.rowid, new.content, new.book_name);
        END
    `);
}

export function openOrCreateDatabase(dbPath, force = false) {
    if (force && existsSync(dbPath)) {
        rmSync(dbPath);
    }

    let isNew = !existsSync(dbPath);
    let db;

    try {
        db = new DatabaseSync(dbPath);
        createSchema(db);
        db.prepare('SELECT id, content FROM bible_verses LIMIT 1').all();
    } catch {
        if (db) {
            db.close();
        }
        if (existsSync(dbPath)) {
            rmSync(dbPath);
        }
        db = new DatabaseSync(dbPath);
        createSchema(db);
        isNew = true;
    }

    return { db, isNew };
}
export function syncBibleDatabase(db, sourceData) {
    const selectVerse = db.prepare(
        `SELECT book_name, book, testament, chapter, verse, content
         FROM bible_verses
         WHERE id = ?`,
    );
    const insertVerse = db.prepare(
        `INSERT INTO bible_verses (id, book_name, book, testament, chapter, verse, content)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const updateVerse = db.prepare(
        `UPDATE bible_verses
         SET book_name = ?, book = ?, testament = ?, chapter = ?, verse = ?, content = ?
         WHERE id = ?`,
    );
    const deleteVerse = db.prepare(`DELETE FROM bible_verses WHERE id = ?`);

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let deleted = 0;

    const validIds = new Set(sourceData.verseRows.map((row) => row.id));

    db.exec('BEGIN');
    try {
        for (const row of sourceData.verseRows) {
            const existing = selectVerse.get(row.id);

            if (!existing) {
                insertVerse.run(
                    row.id,
                    row.bookName,
                    row.book,
                    row.testament,
                    row.chapter,
                    row.verse,
                    row.content,
                );
                inserted++;
                continue;
            }

            const same =
                existing.book_name === row.bookName &&
                existing.book === row.book &&
                existing.testament === row.testament &&
                existing.chapter === row.chapter &&
                existing.verse === row.verse &&
                existing.content === row.content;

            if (same) {
                unchanged++;
                continue;
            }

            updateVerse.run(
                row.bookName,
                row.book,
                row.testament,
                row.chapter,
                row.verse,
                row.content,
                row.id,
            );
            updated++;
        }

        for (const row of db.prepare('SELECT id FROM bible_verses').all()) {
            if (!validIds.has(row.id)) {
                deleteVerse.run(row.id);
                deleted++;
            }
        }

        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }

    const finalVerseCount = db.prepare('SELECT COUNT(*) AS count FROM bible_verses').get().count;

    return {
        inserted,
        updated,
        unchanged,
        deleted,
        finalVerseCount,
    };
}
