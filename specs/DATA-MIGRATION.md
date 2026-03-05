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
│  index.json ← manifest listing available language packs      │
│  index-en.zip ← English Tantivy index (341K paragraphs)     │
│  index-orm.zip ← Oromo Tantivy index (25K paragraphs)       │
│  index-fr.zip ← French Tantivy index (future)               │
│  bible-fr.zip ← French Bible SQLite                         │
│  ...                                                         │
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

### Data Layer Split

| Data                                                              | Storage                        | Why                                                                     |
| ----------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Sermon content (paragraphs)                                       | Tantivy indexes                | Full-text search, paragraph-level access, LZ4 compression, per-language |
| Sermon metadata (titles, dates, links)                            | SQLite `sermon_metadata` table | Relational queries, joins with app data, small dataset                  |
| Bible verses                                                      | SQLite + FTS5                  | Structured (book/chapter/verse), FTS5 for search, already implemented   |
| App state (notes, subjects, history, tabs, audio, backup, config) | SQLite (Drizzle ORM)           | Already implemented in Phase 3                                          |
| Full-text search                                                  | Tantivy                        | Native ranking, stemming, snippet generation                            |

## 3. index.json Manifest Format

Hosted at `https://github.com/paradoxe35/wmb-table/releases/download/v1.0.0/index.json`

```jsonc
{
    "version": 1,
    "languages": [
        {
            "code": "en",
            "language": "English",
            "sermons_available": 887,
            "sermons_with_audio": 593,
            "filename": "index-en.zip",
            "filesize": 45000000,
            "checksum": "sha256:abc123...",
        },
        {
            "code": "orm",
            "language": "Afaan Oromoo",
            "sermons_available": 120,
            "sermons_with_audio": 0,
            "filename": "index-orm.zip",
            "filesize": 3500000,
            "checksum": "sha256:def456...",
        },
        {
            "code": "fr",
            "language": "Francais",
            "sermons_available": 1769,
            "sermons_with_audio": 593,
            "filename": "index-fr.zip",
            "filesize": 52000000,
            "checksum": "sha256:789abc...",
        },
    ],
    "bible": [
        {
            "code": "fr",
            "language": "Francais",
            "filename": "bible-fr.zip",
            "filesize": 5200000,
            "checksum": "sha256:...",
        },
    ],
}
```

**Fields:**

- `code` — ISO 639 language code (used as directory name under `indexes/`)
- `language` — Human-readable language name for UI display
- `sermons_available` — Total unique sermons in the index
- `sermons_with_audio` — How many have audio links
- `filename` — ZIP file name in the GitHub release
- `filesize` — Uncompressed size in bytes (for download progress)
- `checksum` — SHA-256 hash for integrity verification

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

### Sermon Metadata in SQLite

The Tantivy index doesn't store sermon-level metadata (title, audio link, PDF link, etc.). This goes in SQLite:

```sql
CREATE TABLE sermon_metadata (
  id            TEXT PRIMARY KEY,
  translation_id INTEGER NOT NULL,    -- matches Tantivy translation_id
  language_code TEXT NOT NULL,         -- 'en', 'fr', 'orm'
  sermon_date   TEXT NOT NULL,         -- '47-0412', '65-1128M'
  title         TEXT NOT NULL,         -- display title in this language
  en_title      TEXT,                  -- English title (for cross-reference)
  audio_link    TEXT,
  pdf_link      TEXT,
  web_link      TEXT,
  date_long     TEXT,                  -- human-readable date string
  paragraph_count INTEGER DEFAULT 0,  -- cached count for UI
  UNIQUE(translation_id, language_code)
);

CREATE INDEX idx_sermon_meta_lang ON sermon_metadata(language_code);
CREATE INDEX idx_sermon_meta_date ON sermon_metadata(sermon_date);
```

**Why separate from Tantivy?** Metadata is queried relationally (filter by language, sort by date, group by year). Tantivy is optimized for full-text search, not SQL-style filtering.

### Translation Cross-Reference

Sermons in different languages share the same `translation_id`. This enables:

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

### 6.2 Sermon Metadata Service (`src/main/services/sermon-metadata.service.ts`)

Bridges Tantivy indexes with SQLite metadata. Builds the `sermon_metadata` table from Tantivy data + legacy title data.

```typescript
// Build metadata from Tantivy index on first install of a language
buildMetadataFromIndex(langCode: string): void

// Queries
getSermonList(langCode: string, options?: { year?: string, search?: string }): SermonMeta[]
getSermonMeta(translationId: number, langCode: string): SermonMeta | null
getAvailableTranslations(translationId: number): { langCode: string, title: string }[]
getSermonsByYear(langCode: string): Record<string, SermonMeta[]>
```

### 6.3 Language Pack Service (`src/main/services/language-pack.service.ts`)

Downloads and manages language packs from GitHub releases.

```typescript
// Fetch manifest
fetchManifest(): Promise<Manifest>

// Download
downloadLanguagePack(langCode: string, onProgress: (pct: number) => void): Promise<void>
deleteLanguagePack(langCode: string): Promise<void>

// Status
getInstalledLanguages(): InstalledLanguage[]
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
'documents:getSermonContent' → SermonContent  (args: [string langCode, number translationId])
'documents:getSermonList'    → SermonMeta[]   (args: [string langCode, options?])
'documents:getSermonsByYear' → Record<string, SermonMeta[]>  (args: [string langCode])
'documents:getTranslations'  → TranslationInfo[]  (args: [number translationId])
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
  │   ├─ YES → Normal startup, load active language
  │   └─ NO  → Show Setup Screen
  │             │
  │             ├─ Fetch index.json from GitHub releases
  │             ├─ Display available languages with sizes
  │             ├─ User selects languages to install
  │             ├─ Download & unzip selected language packs
  │             ├─ Build sermon_metadata from Tantivy index
  │             ├─ Set first installed language as active
  │             └─ Transition to main app
  │
  ├─ Has legacy NeDB files? (upgrade from v1.0.0)
  │   ├─ YES → Run NeDB → SQLite migration (notes, subjects, etc.)
  │   │        Show prompt: "Your sermon data format has changed.
  │   │        Please install language packs to continue."
  │   └─ NO  → Fresh install, no migration needed
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

- `documents-title.db` — fully removed; sermon metadata is now built from Tantivy indexes into the `sermon_metadata` SQLite table
- HTML document files — replaced by Tantivy paragraph data
- `bible.db` → migrated to SQLite in Phase 3 (already done)
- Legacy NeDB code (`src/main/db/`, `src/main/message-control/`, `src/main/features/backup/`, `src/main/features/synchronizer/`) — deleted

## 12. Audio Integration

Audio links are stored in `sermon_metadata`. When a sermon has an `audio_link`:

- Audio player appears in the sermon view header
- Audio download saves to `userData/audio/`
- `audioDocumentTimes` table tracks playback position (keyed by audio_link, unchanged)
- `audioDocumentLastPlay` tracks the last played sermon

The audio system is unchanged from Phase 3 — it reads `audio_link` from `sermon_metadata`.
