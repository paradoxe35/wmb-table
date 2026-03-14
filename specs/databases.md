# Database Architecture

The app uses three separate SQLite databases.

## 1. `data.sqlite` (Reference Data)

**Location:** `resources/database/data.sqlite` (bundled, read-only)

Contains all sermon metadata, language packs, translator info, and audio links. 14 tables, 68K+ rows. Opened read-only with mmap.

Key tables: `sermon`, `language`, `translator`, `audio`.

See `src/main/database/reference-db.ts` and `src/main/database/repositories/reference.repository.ts`.

## 2. `wmb-table.sqlite` (User Data)

**Location:** `~/.wmb-table/databases/wmb-table.sqlite`

User-created and personalized data. Managed by Drizzle ORM with migrations in `drizzle/`.

### Tables

| Table                    | Purpose                              | Synced |
| ------------------------ | ------------------------------------ | ------ |
| `configurations`         | App settings (single row)            | No     |
| `history`                | Document view history                | No     |
| `history_items`          | History entries                      | No     |
| `notes`                  | User notes                           | Yes    |
| `notes_references`       | Sermon paragraph references in notes | Yes    |
| `notes_bible_references` | Bible verse references in notes      | Yes    |
| `subjects`               | Subject/topic groups                 | Yes    |
| `subject_items`          | Items within subjects                | Yes    |
| `suggestions`            | Search suggestions                   | Yes    |
| `custom_documents`       | Uploaded PDF documents               | Yes    |
| `tabs`                   | Open document tabs (single row)      | No     |
| `sidebar_status`         | Sidebar visibility (single row)      | No     |
| `audio_document_times`   | Audio playback positions             | No     |
| `backup_status`          | Last backup timestamp                | No     |

Schema: `src/main/database/schema.ts`

## 3. Bible SQLite (Per-Version)

**Location:** `resources/database/bible.*.sqlite` (local) or `userData/databases/bibles/` (downloaded)

One file per Bible version. Read-only. Contains `bible_verses` table + FTS5.

See [bible.md](./bible.md) for details.

## 4. `sync.sqlite` (Change Tracking)

**Location:** `~/.wmb-table/databases/sync.sqlite`

Tracks changes for Google Drive sync. 4 tables: `change_logs`, `sync_state`, `processed_changes`, `apply_failures`.

Schema: `src/main/database/sync-schema.ts`

## Key Patterns

- **Text primary keys** with `crypto.randomUUID()`
- **JSON-in-TEXT columns** serialized/deserialized in the repository layer
- **Read-only databases** opened with mmap (256MB) and cache pragmas
- **Testing:** in-memory SQLite via `_setDbForTesting()` helpers
- **Migrations:** single Drizzle migration in `drizzle/0000_panoramic_ultimatum.sql`
