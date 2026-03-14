# Bible Architecture

## Overview

The app supports multiple Bible versions per language. Each Bible is a standalone SQLite file opened read-only. Only one Bible is active at a time.

## Database Schema

Each Bible file contains a single table and an FTS5 virtual table for full-text search.

### `bible_verses`

| Column      | Type | Description                           |
| ----------- | ---- | ------------------------------------- |
| `id`        | TEXT | Primary key (e.g. `002RtB2ShziXO7Yq`) |
| `book_name` | TEXT | Human-readable name (e.g. `Luc`)      |
| `book`      | TEXT | Book code (e.g. `42N`)                |
| `testament` | TEXT | `OT` or `NT`                          |
| `chapter`   | TEXT | Chapter number                        |
| `verse`     | TEXT | Verse number                          |
| `content`   | TEXT | Full verse text                       |

### `bible_verses_fts` (FTS5)

```sql
CREATE VIRTUAL TABLE bible_verses_fts USING fts5(
  content, book_name,
  content='bible_verses', content_rowid='rowid',
  tokenize='unicode61'
);
```

Maintained by `AFTER INSERT/DELETE/UPDATE` triggers on `bible_verses`.

## File Naming

```
bible.{langCode}-{abbreviation}.sqlite
```

Examples:

- `bible.fr-lsg.sqlite` (French Louis Segond)
- `bible.en-kjv.sqlite` (English King James Version)

## Version Index

### Local index

`resources/database/bible-index.json` lists bundled Bibles:

```json
[
    {
        "langCode": "fr",
        "abbreviation": "lsg",
        "name": "Louis Segond",
        "fileName": "bible.fr-lsg.sqlite",
        "type": "local"
    }
]
```

### Remote index

Fetched from GitHub releases and cached at `userData/databases/bibles/bible-index.remote.json`. Remote versions are downloaded on demand.

### Merge logic

- Local entries are authoritative (override remote by abbreviation)
- Remote entries only add new versions
- Remote entries always get `type: "remote"`

## Storage Locations

| Type   | Path                                                       |
| ------ | ---------------------------------------------------------- |
| Local  | `resources/database/bible.{lang}-{abbr}.sqlite`            |
| Remote | `~/.wmb-table/databases/bibles/bible.{lang}-{abbr}.sqlite` |

## Version Switching

1. User clicks a version tag in `BibleVersionSelector`
2. IPC `bible:switchVersion(abbreviation)` called
3. Service closes current Bible DB, opens new one (read-only, mmap 256MB)
4. `bible-version-changed` event fires, UI reloads book index

Fallback order for `switchBibleForLanguage(langCode)`:

1. First available version for requested language
2. English (`en`) fallback
3. First available version of any language

## Note Bible References

Verses saved in notes are **snapshots** — the full `BibleBook` object (id, bookName, chapter, verse, content) is stored at the time of creation. This means:

- Saved references always display correctly regardless of the active Bible version
- Verse IDs are specific to the Bible file they came from
- Adding verses uses whichever Bible is currently active

## IPC Channels

| Channel                  | Args                | Returns              |
| ------------------------ | ------------------- | -------------------- |
| `bible:getIndexes`       | none                | `BibleIndex`         |
| `bible:getBooks`         | `BookRequest`       | `BibleBook[]`        |
| `bible:search`           | `query, pageNumber` | `BibleSearchResult`  |
| `bible:getVersions`      | none                | `BibleVersionInfo[]` |
| `bible:getAllVersions`   | none                | `BibleVersionInfo[]` |
| `bible:getActiveVersion` | none                | `BibleVersionInfo`   |
| `bible:switchVersion`    | `abbreviation`      | void                 |
| `bible:downloadVersion`  | `abbreviation`      | void                 |
| `bible:refreshIndex`     | none                | `BibleVersionInfo[]` |

## Push Channels

| Channel                      | Payload                                        |
| ---------------------------- | ---------------------------------------------- |
| `push:bibleDownloadProgress` | `{ abbreviation: string, percentage: number }` |
| `push:bibleDownloaded`       | `{ abbreviation: string }`                     |

## Creating a New Bible File

A Bible SQLite file must contain:

1. The `bible_verses` table with all verses
2. The `bible_verses_fts` FTS5 virtual table
3. The FTS5 triggers for sync

See `src/main/database/bible-schema.ts` for the exact SQL.

Add an entry to `bible-index.json` (local) or the remote index, then the app will pick it up automatically.
