import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const bibleVerses = sqliteTable('bible_verses', {
    id: text('id').primaryKey(),
    bookName: text('book_name').notNull(),
    book: text('book').notNull(),
    testament: text('testament').notNull(),
    chapter: text('chapter').notNull(),
    verse: text('verse').notNull(),
    content: text('content').notNull(),
});

/** Raw SQL for FTS5 virtual table — Drizzle does not support virtual tables */
export const BIBLE_FTS_SETUP_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS bible_verses_fts USING fts5(
  content, book_name, content='bible_verses', content_rowid='rowid',
  tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS bible_verses_ai AFTER INSERT ON bible_verses BEGIN
  INSERT INTO bible_verses_fts(rowid, content, book_name)
  VALUES (new.rowid, new.content, new.book_name);
END;

CREATE TRIGGER IF NOT EXISTS bible_verses_ad AFTER DELETE ON bible_verses BEGIN
  INSERT INTO bible_verses_fts(bible_verses_fts, rowid, content, book_name)
  VALUES ('delete', old.rowid, old.content, old.book_name);
END;

CREATE TRIGGER IF NOT EXISTS bible_verses_au AFTER UPDATE ON bible_verses BEGIN
  INSERT INTO bible_verses_fts(bible_verses_fts, rowid, content, book_name)
  VALUES ('delete', old.rowid, old.content, old.book_name);
  INSERT INTO bible_verses_fts(rowid, content, book_name)
  VALUES (new.rowid, new.content, new.book_name);
END;
`;
