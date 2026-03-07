# WMB Table — Data Migration & Multi-Language Document System

## 1. Context

### Problem

The legacy v1.0.0 system has critical data architecture flaws:

1. **Documents are pre-rendered HTML files** (1,769 files, ~63MB) bundled inside the installation directory. Each sermon is a full HTML document loaded via iframe. This means:
    - Data is lost on app update/reinstall
    - No structured access to paragraphs — search parses raw HTML at runtime (very slow)
    - Single language only (French) — adding languages requires shipping more HTML files
    - No way for users to download additional language packs

2. **Database is NeDB** (JSON file-per-line) — no indexing, no full-text search, no relational integrity

3. **Document metadata** was stored in `documents-title.db` (now removed) — sermon titles, dates, audio/PDF/web links are now in the `sermon_metadata` SQLite table built from Tantivy indexes

### Solution

Replace the entire document storage with **Tantivy full-text search indexes** as the source of truth for sermon content, and **SQLite** for everything else (app state, Bible, metadata).

**Key design change:** Each sermon is stored as individual paragraphs in a Tantivy index. The app renders paragraphs natively in React instead of loading HTML files in an iframe. This enables:

- Multi-language support (one Tantivy index per language)
- Instant full-text search with ranking and snippets
- User-selectable language packs downloaded from GitHub releases
- Dramatically smaller app bundle (Tantivy indexes are LZ4-compressed)

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    GitHub Release v1.0.0                      │
│                                                              │
│  index-en.zip ← English Tantivy index (341K paragraphs)     │
│  index-orm.zip ← Oromo Tantivy index (25K paragraphs)       │
│  index-fr.zip ← French Tantivy index                        │
│  bible-fr.zip ← French Bible SQLite                         │
│  ...                                                         │
│  (download URLs derived from data.sqlite language table)     │
└──────────────────────────┬───────────────────────────────────┘
                           │ User downloads on first launch
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              app.getPath('userData')                          │
│                                                              │
│  databases/                                                  │
│    wmb-table.sqlite  ← app state (Drizzle ORM)              │
│    bible.sqlite      ← Bible verses + FTS5                  │
│                                                              │
│  indexes/                                                    │
│    en/               ← English Tantivy index (read-only)     │
│      meta.json, *.store, *.term, *.idx, ...                  │
│    orm/              ← Oromo Tantivy index (read-only)       │
│    fr/               ← French Tantivy index                  │
│                                                              │
│  audio/              ← Downloaded audio files                │
│  backups/            ← Google Drive backup data              │
└──────────────────────────────────────────────────────────────┘
```

### Data Layer Split — Two-Database Architecture

| Data                                                              | Storage                                     | Why                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| Sermon/language/translator/audio reference data                   | `data.sqlite` (read-only, bundled)          | Single source of truth, 14 tables, 68K+ rows, no user writes needed     |
| Sermon content (paragraphs)                                       | Tantivy indexes                             | Full-text search, paragraph-level access, LZ4 compression, per-language |
| Bible verses                                                      | SQLite + FTS5                               | Structured (book/chapter/verse), FTS5 for search                        |
| App state (notes, subjects, history, tabs, audio, backup, config) | `wmb-table.sqlite` (Drizzle ORM, user data) | Personalized data, user writes                                          |
| Full-text search                                                  | Tantivy                                     | Native ranking, stemming, snippet generation                            |

## 3. Reference Database (`data.sqlite`)

All sermon metadata, language info, translator data, and audio paths are stored in a bundled read-only SQLite database at `resources/database/data.sqlite` (10 MB, 14 tables, 68,808 rows). This replaces:

- The `sermon_metadata` Drizzle table (previously built dynamically from Tantivy scans)
- The `languages-index.json` file (previously used for language discovery)
- The `buildMetadataFromIndex()` + `assignTraductionNames()` service functions

### Schema (14 tables)

```
language         — 81 languages (code, title, nativeTitle, url, storageBucket, etc.)
sermon           — 1,207 sermons (id like "53-0403", title, dateMs, minutes)
translation      — 30,066 translations (title per language/translator/sermon)
translator       — 152 translators (translatorId = Tantivy translation_id)
audio            — 18,096 audio file paths
location         — sermon venues (joined via sermon.location_id)
country, state, city — geography hierarchy
series, series_translation, sermon_series — sermon series data
audio_title      — audio title values
revision         — schema version tracking
```

### Key Data Relationships

- `translator.translator_id` (numeric: 0,1,2,3...) = Tantivy `translation_id` field
- `sermon.id` ("53-0403") → strip dash + suffix → Tantivy `sermon_date` (530403)
- English: `translations_support=0`, no translator rows, Tantivy `translation_id=0`
- French: SHP(tid=2, 1206 sermons), VGR(tid=3, 364 sermons)
- Audio URL = `https://s3.eu-central-1.wasabisys.com/{storage_bucket}/{audio_path}{audio.path}`
- Language download URL: `language.url` (full Wasabi S3 URL)

### Download sources (dual, with automatic fallback):

1. **Primary:** `language.url` from data.sqlite (Wasabi S3)
2. **Fallback:** `https://github.com/paradoxe35/wmb-table/releases/download/v1.0.0/{language.file_name}`

## 4. Tantivy Index Schema

Each language pack is a Tantivy index where **every document is one paragraph** of a sermon.

### Current Schema (v1.0.0 indexes)

```
sermon_date:      i64   (stored, indexed, fast) — date as integer e.g. 470412
line_index:       u64   (stored, indexed, fast) — paragraph number within sermon
paragraph_index:  u64   (stored, fast)          — display order index
translation_id:   u64   (stored, indexed, fast) — unique sermon identifier
stemmed_content:  text  (stored, en_stem)        — English stemmed text (EN only)
unstemmed_content: text (stored, default)        — raw paragraph text
```

**Key relationships:**

- `translation_id` groups all paragraphs belonging to the same sermon
- `line_index` orders paragraphs within a sermon (0, 1, 2, ...)
- `sermon_date` is the date code (e.g. `470412` = April 12, 1947)
- English index has `stemmed_content` (en_stem tokenizer) for better search; other languages only have `unstemmed_content`

### Sermon Metadata from data.sqlite

The Tantivy index stores only paragraph content. All sermon-level metadata (title, audio, location, duration, translators) comes from `data.sqlite` via `reference.repository.ts` and `reference-data.service.ts`.

The `sermon_metadata` user DB table has been **dropped** (migration `0005_common_banshee.sql`). All metadata queries now go to the bundled read-only `data.sqlite`.

### Translation Cross-Reference

Sermons across languages are linked via `sermon.isar_id` in the `translation` table. This enables:

- "View this sermon in English" button
- Cross-language search results grouping
- Knowing which sermons are available in which languages

The legacy `other_traductions` field maps to this naturally — same sermon, different language indexes.

## 5. Node.js Tantivy Library

**Replace `@bigmoves/tantivy-js` with `@oxdev03/node-tantivy-binding`**

| Feature             | `@bigmoves/tantivy-js`            | `@oxdev03/node-tantivy-binding`                       |
| ------------------- | --------------------------------- | ----------------------------------------------------- |
| u64 fields          | Not supported (only i64, text)    | Full support via `addUnsigned`                        |
| Open existing index | `Index.open(path, schema)`        | `Index.open(path)` — reads schema from index          |
| Schema from JSON    | Not supported                     | `Schema.fromJson(json)`                               |
| Document access     | Returns JSON string, must parse   | `Document.toDict()` returns JS object                 |
| Query builder       | Basic (search on fields)          | Full: term, phrase, boolean, fuzzy, regex, range      |
| Snippets            | Not supported                     | `SnippetGenerator` with highlighting                  |
| Ordering            | Not supported                     | `orderByField` with `Order.Asc/Desc`                  |
| Custom tokenizers   | Not supported                     | `TextAnalyzerBuilder` + `Filter` (stemmer, stopwords) |
| Pagination          | Not supported                     | `offset` + `limit` on `searcher.search()`             |
| Platforms           | linux-x64 only (via symlink hack) | linux-x64, darwin-arm64, darwin-x64, win32-x64        |

## 6. Main Process Services

### 6.1 Tantivy Service (`src/main/services/tantivy.service.ts`)

Manages all Tantivy index operations. Opens indexes lazily when a language is first accessed.

```typescript
// Core API
initializeTantivy(): void                    // scan indexes/ dir, register tokenizers
getAvailableLanguages(): LanguageInfo[]      // list installed indexes
openIndex(langCode: string): Index           // open or return cached Index
closeAll(): void                             // cleanup on app quit

// Sermon content
getSermonParagraphs(langCode: string, translationId: number): Paragraph[]
getSermonByDate(langCode: string, sermonDate: number): Paragraph[]

// Search
searchSermons(langCode: string, query: string, limit: number, offset: number): SearchResult
getSnippet(langCode: string, query: string, translationId: number): string

// Index management
getUniqueSermons(langCode: string): SermonSummary[]  // distinct translation_ids with dates
```

### 6.2 Reference Data Service (`src/main/services/reference-data.service.ts`)

Combines data.sqlite queries with Tantivy. Replaces the old `sermon-metadata.service.ts`.

```typescript
getSermonListForLanguage(langCode: string): SermonMeta[]
getSermonListDeduplicated(langCode: string): SermonMetaWithTraductions[]
getSermonMeta(translatorId: number, langCode: string, sermonDate?: string): SermonMeta | null
getTraductionsForSermon(sermonDate: string, langCode: string): SermonMeta[]
getTranslationsForSermon(sermonId: string): { languageCode, title, translatorName }[]
getSermonsByYear(langCode: string): Record<string, SermonMeta[]>
```

### 6.3 Language Pack Service (`src/main/services/language-pack.service.ts`)

Downloads and manages language packs using `data.sqlite` for language metadata.

```typescript
// Download (dual-source: data.sqlite URL → GitHub fallback)
downloadLanguagePack(langCode: string, onProgress: (pct: number) => void): Promise<void>
deleteLanguagePack(langCode: string): Promise<void>

// Status (uses reference.repository for language info)
getInstalledLanguages(): Promise<InstalledLanguage[]>
getDownloadableLanguages(): Promise<DownloadableLanguage[]>
```

## 7. IPC Changes

### New Channels

```typescript
// Language management
'languages:getInstalled'     → InstalledLanguage[]
'languages:getAvailable'     → DownloadableLanguage[]
'languages:install'          → void  (args: [string langCode])
'languages:delete'           → void  (args: [string langCode])

// Push events
'push:languageDownloadProgress' → { langCode: string, percentage: number }
'push:languageInstalled'        → { langCode: string }

// Sermon content (replaces documents:getContentPath)
'documents:getSermonContent' → SermonContent  (args: [string langCode, number translationId, string sermonDate])
'documents:getSermonList'    → SermonMeta[]   (args: [string langCode, options?])
'documents:getSermonsByYear' → Record<string, SermonMeta[]>  (args: [string langCode])
'documents:getTranslations'  → { languageCode, title, translatorName }[]  (args: [string sermonId])
```

### Modified Channels

```typescript
// documents:getTitles — now takes langCode parameter
'documents:getTitles' → SermonMeta[]  (args: [string langCode])

// search:searchText — now uses Tantivy instead of HTML parsing
'search:searchText' → TantivySearchResult  (args: [string langCode, string query, number page])

// search:searchContent — replaced by Tantivy snippet
'search:searchContent' → string  (args: [string langCode, string query, number translationId])
```

### Removed Channels

```typescript
// documents:getContentPath — no more HTML file paths
// (replaced by documents:getSermonContent which returns paragraphs)
```

## 8. Renderer Changes

### 8.1 Language Selector

**Location:** Sidebar header, above document list (`sidebar-documents.tsx`)

```
┌─────────────────────────┐
│ 🌐 English        ▼    │  ← Language dropdown
│ 887 sermons available   │
├─────────────────────────┤
│ [All] [Years] [A-Z]    │  ← Existing tabs
│ ┌─────────────────────┐ │
│ │ 🔍 Search sermons   │ │
│ └─────────────────────┘ │
│ Abraham (2)             │
│ Abraham (3)             │
│ Adoption                │
│ ...                     │
└─────────────────────────┘
```

- Dropdown shows installed languages with sermon counts
- "Manage Languages" option opens language management modal
- Changing language reloads the sermon list from that language's metadata
- Selected language persists in app config

### 8.2 Language Management Modal

```
┌──────────────────────────────────────────────┐
│  Manage Languages                        ✕   │
├──────────────────────────────────────────────┤
│                                              │
│  ✅ English         887 sermons    [Delete]  │
│     45 MB installed                          │
│                                              │
│  ✅ Afaan Oromoo    120 sermons    [Delete]  │
│     3.5 MB installed                         │
│                                              │
│  ⬇️  Francais       1,769 sermons [Install]  │
│     52 MB download                           │
│                                              │
│  ⬇️  Deutsch        800 sermons   [Install]  │
│     38 MB download                           │
│                                              │
│  ━━━━━━━━━━━━━━━━━━━━━ 65%                  │
│  Downloading Francais...                     │
│                                              │
└──────────────────────────────────────────────┘
```

### 8.3 Tab System (replaces Chrome Tabs)

**Replace the legacy `ChromeTabs` class + `draggabilly` with `framer-motion` `Reorder`.**

The legacy tab system (`src/renderer/plugins/chrome-tabs/chrome-tabs.ts`) is a 400-line imperative class that:

- Uses `draggabilly` for drag-and-drop (unmaintained library)
- Renders SVG tab shapes mimicking Chrome's old tab design
- Manages layout via manual `transform: translate3d()` calculations
- Communicates via custom DOM events (`tabReorder`, `activeTabChange`, `tabRemove`)

Replace with `framer-motion`'s `Reorder` component (~50 lines of declarative React):

```typescript
// New: src/renderer/components/sermon-tabs.tsx
import { Reorder, AnimatePresence, motion } from 'framer-motion';

function SermonTabs({ tabs, selectedTab, onSelect, onRemove, onReorder }) {
  return (
    <nav className="sermon-tabs">
      <Reorder.Group
        as="ul"
        axis="x"
        values={tabs}
        onReorder={onReorder}
        className="sermon-tabs-list"
      >
        <AnimatePresence initial={false}>
          {tabs.map((tab) => (
            <SermonTab
              key={tab.translationId}
              tab={tab}
              isSelected={tab.translationId === selectedTab?.translationId}
              onSelect={() => onSelect(tab)}
              onRemove={() => onRemove(tab)}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>
    </nav>
  );
}

function SermonTab({ tab, isSelected, onSelect, onRemove }) {
  return (
    <Reorder.Item
      value={tab}
      id={String(tab.translationId)}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.15 } }}
      exit={{ opacity: 0, y: 20, transition: { duration: 0.3 } }}
      whileDrag={{ backgroundColor: "var(--tab-drag-bg)" }}
      className={isSelected ? "sermon-tab selected" : "sermon-tab"}
      onPointerDown={onSelect}
    >
      <motion.span layout="position">{tab.title}</motion.span>
      <motion.button
        className="sermon-tab-close"
        onPointerDown={(e) => { e.stopPropagation(); onRemove(); }}
      >
        <CloseIcon />
      </motion.button>
    </Reorder.Item>
  );
}
```

**What gets removed:**

- `src/renderer/plugins/chrome-tabs/chrome-tabs.ts` — 414-line imperative ChromeTabs class
- `src/renderer/components/document-tabs.tsx` — legacy wrapper with Recoil + ChromeTabs init
- `draggabilly` dependency
- Chrome tab SVG shapes and associated SCSS styles
- Custom DOM events: `tabReorder`, `activeTabChange`, `tabRemove`

**Content area animation** — Tab content transitions use `AnimatePresence` with `mode="wait"`:

```typescript
<main>
  <AnimatePresence mode="wait">
    <motion.div
      key={selectedTab?.translationId ?? "empty"}
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 20 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.15 }}
    >
      <SermonView ... />
    </motion.div>
  </AnimatePresence>
</main>
```

### 8.4 Sermon View (replaces Document View)

**Replace iframe-based `document-view.tsx` with native React paragraph rendering.**

```
┌─────────────────────────────────────────────────────┐
│ [Tab1] [Tab2] [Tab3]  ← framer-motion Reorder tabs │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Abraham (2)                                        │
│  April 12, 1947 — SHP                              │
│  [🌐 Also in: Francais, Afaan Oromoo]              │
│                                                     │
│  ─────────────────────────────────────              │
│                                                     │
│  1. Now, tonight we're going to speak on            │
│  the subject of Abraham. And I want you             │
│  to turn with me in your Bibles to...              │
│                                                     │
│  2. And we find that Abraham was called             │
│  out of the land of the Chaldeans, out of           │
│  the city of Ur...                                  │
│                                                     │
│  3. [highlighted: "Abraham was seventy"]            │  ← search hit highlight
│  five years old when God first called him.          │
│                                                     │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

**Key changes from legacy:**

- No iframe — paragraphs rendered as React components
- Each paragraph has a line number (from `line_index`)
- Search highlights rendered inline via Tantivy `SnippetGenerator`
- "Also in" shows other languages where this sermon is available
- Zoom/scroll state managed directly in React (no postMessage)
- Subject/note references can point to specific paragraph indexes instead of DOM tree paths

### 8.4 Search Results

Search now uses Tantivy directly instead of parsing HTML files:

```
┌─────────────────────────────────────────────────────┐
│  Search: "Abraham"                                  │
│  Found 245 results in English                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Abraham (2) — 47-0412                              │
│  "...And we find that **Abraham** was called        │
│   out of the land of the Chaldeans..."              │
│                                                     │
│  The Seed of Abraham — 61-0416                      │
│  "...Now, **Abraham**, as we know, was a            │
│   patriarch of the faith..."                        │
│                                                     │
│  [Load more...]                                     │
└─────────────────────────────────────────────────────┘
```

### 8.5 State Management Changes

Replace Recoil atoms with Zustand stores (or update existing):

```typescript
// New store: language.store.ts
interface LanguageStore {
    installedLanguages: InstalledLanguage[];
    activeLanguage: string; // language code
    setActiveLanguage: (code: string) => void;
    refreshInstalled: () => Promise<void>;
}

// Modified: document.store.ts
interface DocumentStore {
    sermons: SermonMeta[]; // replaces Title[]
    sermonsByYear: Record<string, SermonMeta[]>;
    activeSermon: SermonContent | null; // replaces path-based loading
    loadSermons: (langCode: string) => Promise<void>;
    loadSermonContent: (langCode: string, translationId: number) => Promise<void>;
}
```

## 9. Reference System Updates

### DocumentHtmlTree → ParagraphReference

The legacy system references locations within documents using `DocumentHtmlTree` (DOM tree path + scroll position). Since we no longer have an iframe DOM, references need to point to **paragraph indexes** instead.

```typescript
// Legacy
type DocumentHtmlTree = {
    tree: number[]; // DOM node path
    scrollY?: number;
    scrollX?: number;
    ranges?: DocumentTreeRanges; // text selection in DOM
};

// New
type ParagraphReference = {
    paragraphIndex: number; // line_index from Tantivy
    translationId: number; // sermon identifier
    languageCode: string;
    textSnippet?: string; // stored snippet for display
};
```

This affects:

- **Notes references** (`notesReferences.documentHtmlTree`)
- **Subject item references** (`subjectItems.documentHtmlTree`)

**Migration strategy:** Existing references that use `DocumentHtmlTree` will store a `legacyTree` field. The app will show a "legacy reference" indicator but can still display the referenced sermon. New references created after migration use `ParagraphReference`.

## 10. First Launch Flow

```
App starts
  │
  ├─ Has indexes/ directory with at least 1 language?
  │   ├─ YES → Normal startup, load active language, open matching Bible version
  │   └─ NO  → Show Setup Screen
  │             │
  │             ├─ Query available languages from data.sqlite (refRepo.getAllLanguages())
  │             ├─ Display available languages with sizes
  │             ├─ User selects languages to install
  │             ├─ Download & unzip selected language packs (URLs from data.sqlite language table)
  │             ├─ Set first installed language as active
  │             ├─ Bible auto-switches to matching version (or fallback)
  │             └─ Transition to main app
  │
  └─ Continue to main app
```

## 11. Legacy Data Migration (NeDB → SQLite)

Already implemented in Phase 3 (`src/main/database/migrate-from-nedb.ts`). Migrates:

- Notes, notesReferences, notesBibleReferences
- Subjects, subjectItems (DocumentHtmlTree stored as-is with `legacyTree` marker)
- History, historyItems
- Tabs, suggestions, sidebarStatus
- Audio times, downloads, last play
- Backup status, references
- Configurations

**What is NOT migrated:**

- `documents-title.db` — fully removed; sermon metadata comes from `data.sqlite`
- HTML document files — replaced by Tantivy paragraph data
- `bible.db` — Bible data now comes from pre-built bundled SQLite files (see Section 12)
- Legacy NeDB code (`src/main/db/`, `src/main/message-control/`, `src/main/features/backup/`, `src/main/features/synchronizer/`) — deleted

## 12. Bible Architecture

Bible data is bundled as pre-built read-only SQLite files in `resources/database/`. Each file contains the `bible_verses` table + FTS5 index for one Bible version.

### Bible Index

`resources/database/bible-index.json` lists all available Bible versions:

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

### Naming Convention

`bible.{langCode}-{abbreviation}.sqlite` — e.g., `bible.fr-lsg.sqlite`

### Version Types

- **`local`** — bundled in `resources/database/`, shipped with the app
- **`remote`** — downloaded on demand from GitHub release (`v1.0.0/{fileName}`), saved to `userData/databases/bibles/`

### Schema (per file)

```sql
bible_verses (id, book_name, book, testament, chapter, verse, content) + FTS5
```

### Bible Service (`src/main/services/bible.service.ts`)

- `loadBibleIndex()` — reads `bible-index.json`
- `getBibleVersionsForLanguage(langCode)` — filter by language
- `switchBibleForLanguage(langCode)` — close current, open matching version (fallback chain: lang → en → first available)
- `switchBibleVersion(abbreviation)` — switch to a specific version
- `downloadBibleVersion(abbreviation, onProgress)` — download remote Bible from GitHub release
- `isBibleAvailable(version)` — check if file exists (local in resources or remote in userData)
- Bible DB is opened read-only with mmap, same pattern as `data.sqlite`
- Switches automatically when active language changes via `app:setActiveLanguage` IPC

### IPC Channels

- `bible:getVersions` → `BibleVersionInfo[]` — versions for current language
- `bible:getAllVersions` → `BibleVersionInfo[]` — all versions across all languages
- `bible:getActiveVersion` → `BibleVersionInfo | null` — current active version
- `bible:switchVersion` → void — switch to a specific version by abbreviation
- `bible:downloadVersion` → void — download a remote Bible version
- `push:bibleDownloadProgress` → `{ abbreviation, percentage }` — download progress
- `push:bibleDownloaded` → `{ abbreviation }` — download completed

### Current Data

- `bible.fr-lsg.sqlite` (local) — Louis Segond (31,102 verses, 10.2 MB)
- Built from legacy NeDB `bible.db` data, pre-populated with FTS5 index

## 13. Audio Integration

Audio URLs are constructed from `data.sqlite` (`audio.path` + `language.audio_path` + `language.storage_bucket`). When a sermon has audio:

- Audio player appears in the sermon view header
- Audio download saves to `userData/audio/`
- `audioDocumentTimes` table tracks playback position (keyed by audio_link, unchanged)
- `audioDocumentLastPlay` tracks the last played sermon

Audio URL format: `https://s3.eu-central-1.wasabisys.com/{storage_bucket}/{audio_path}{audio.path}`
