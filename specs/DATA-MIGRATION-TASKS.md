# WMB Table — Data Migration Task List

Step-by-step execution plan for the data migration described in [DATA-MIGRATION.md](./DATA-MIGRATION.md).

Each phase produces a working (or at least buildable) application before proceeding to the next.

**Pre-requisites completed:**

- Phase 1 (Build system) — done
- Phase 2 (Typed IPC, preload, security) — done
- Phase 3 (SQLite + Drizzle, repositories, IPC wiring) — done
- Phase A (Library swap & Tantivy service) — done
- Phase B (Sermon metadata & language pack service) — done

---

## Phase A: Library Swap & Tantivy Service ✅

Replace `@bigmoves/tantivy-js` with `@oxdev03/node-tantivy-binding` and create the core Tantivy service.

### A.1 — Install New Library

- [x] **A.1.1** Remove `@bigmoves/tantivy-js` from dependencies
- [x] **A.1.2** Install `@oxdev03/node-tantivy-binding` — verify native binary loads on current platform
- [x] **A.1.3** Add `@oxdev03/node-tantivy-binding` to `pnpm.onlyBuiltDependencies` in `package.json` and `pnpm-workspace.yaml`
- [x] **A.1.4** Verify: `pnpm build` succeeds, native `.node` binary is bundled correctly

### A.2 — Tantivy Service

- [x] **A.2.1** Create `src/main/services/tantivy.service.ts`:
    - `initializeTantivy()` — scan `userData/indexes/` for installed language directories
    - `openIndex(langCode)` — open Tantivy `Index` from `indexes/{langCode}/`, register tokenizers from `meta.json`, cache in memory
    - `closeAllIndexes()` — cleanup all open indexes and caches
    - `getInstalledLanguages()` — return list of installed language codes
- [x] **A.2.2** Add sermon content retrieval functions:
    - `getSermonParagraphs(langCode, translationId)` — query by `translation_id`, order by `line_index` asc, return `SermonParagraph[]` (includes `stemmedContent` for EN)
    - `getUniqueSermonDates(langCode)` — AllQuery ordered by `translation_id`, deduplicate using `hit.order`, cache per langCode
- [x] **A.2.3** Add full-text search functions:
    - `searchSermons(langCode, query, limit, offset)` — parse query against all text fields, fetch paragraphs, group by `translation_id`, sort by score, paginate
    - `getSearchSnippet(langCode, query, docAddress)` — `SnippetGenerator` on `unstemmed_content`, return HTML with `<b>` highlights
- [x] **A.2.4** Register custom tokenizers from `meta.json` (e.g. `en_stem` → simple + lowercase + stemmer('english'))
- [x] **A.2.5** Wire into main process lifecycle:
    - Call `initializeTantivy()` in `src/main/index.ts` after `initializeDatabase()`
    - Call `closeAllIndexes()` in `will-quit` handler before `closeDatabase()`

### A.3 — Unit Tests

- [x] **A.3.1** Create `tests/unit/main/services/tantivy.service.test.ts` — 8 tests:
    - Oromo index (no custom tokenizer): installed languages, unique sermon dates, ordered paragraphs, grouped search results, HTML snippet highlights
    - English index (validates `en_stem` tokenizer): paragraphs with `stemmedContent`, stemmed search matching
- [x] **A.3.2** Verify: `pnpm test` passes (70 tests, 15 files), `pnpm typecheck` 0 errors, `pnpm build` succeeds

---

## Phase B: Sermon Metadata & Language Pack Service ✅

### B.1 — Schema Update

- [x] **B.1.1** Add `sermonMetadata` table to `src/main/database/schema.ts`:
    - `id`, `translationId`, `languageCode`, `sermonDate`, `title`, `enTitle`, `audioLink`, `pdfLink`, `webLink`, `dateLong`, `paragraphCount`
    - Unique constraint on `(translationId, languageCode)`
    - Indexes on `languageCode`, `sermonDate`
- [x] **B.1.2** Run `pnpm db:generate` to create new migration (`drizzle/0001_dear_scorpion.sql` — CREATE TABLE)
- [x] **B.1.3** Verify migration applies cleanly

### B.2 — Sermon Metadata Service

- [x] **B.2.1** Create `src/main/services/sermon-metadata.service.ts`:
    - `buildMetadataFromIndex(langCode)` — scan Tantivy index for unique `(translation_id, sermon_date)` pairs, count paragraphs, insert into `sermon_metadata` table
    - Metadata is built purely from Tantivy index data (legacy `documents-title.db` table has been removed)
    - Cross-language metadata population will use `translation_id` to reference existing metadata in other languages
- [x] **B.2.2** Create `src/main/database/repositories/sermon-metadata.repository.ts`:
    - `getSermonList(langCode, options?)` — query by language, optional year filter, sorted by date desc
    - `getSermonMeta(translationId, langCode)` — get single sermon metadata
    - `getSermonsByYear(langCode)` — group by year
    - `getAvailableTranslations(translationId)` — list languages for a sermon
    - `upsertMetadata(data)` — insert or update metadata records (batched, 50 per transaction)
    - `deleteByLanguage(langCode)` — remove all metadata for a language
    - `getLanguagesWithMetadata()` — list distinct language codes
    - `SermonMeta` type defined in `src/shared/types.ts` (shared between main and renderer)
- [x] **B.2.3** Unit tests for sermon metadata repository (10 tests) and service (3 tests)

### B.3 — Language Pack Service

- [x] **B.3.1** Create `src/main/services/language-pack.service.ts`:
    - `fetchManifest()` — download manifest JSON from GitHub release URL, parse, return typed `Manifest`
    - `downloadLanguagePack(langCode, onProgress)` — download ZIP from release, unzip to `indexes/{langCode}/`, call `buildMetadataFromIndex(langCode)`
    - `deleteLanguagePack(langCode)` — close all indexes, remove directory + metadata from SQLite, re-initialize
    - `getInstalledLanguages()` — combine filesystem scan with SQLite metadata counts
    - `getDownloadableLanguages()` — fetch manifest, diff against installed
- [x] **B.3.2** Handle download robustness:
    - Verify SHA-256 checksum after download
    - Atomic extraction (unzip to `.tmp-{langCode}/` dir, rename to final on success)
    - Cleanup temp artifacts before download
    - _(Resume/retry on network failure — not yet implemented)_
- [x] **B.3.3** Unit tests for language pack service (4 tests — mock fetch, manifest parsing)

### B.4 — Verification

- [x] **B.4.1** `pnpm typecheck` — 0 errors (excluding pre-existing tantivy.service.ts issues)
- [x] **B.4.2** `pnpm test` — all 70 tests pass (15 files)
- [ ] **B.4.3** Manual: copy `tmp/` English index to `userData/indexes/en/`, run app, verify metadata builds

### B.5 — Legacy `documents_title` Cleanup

- [x] **B.5.1** Remove `documentsTitle` table from `src/main/database/schema.ts`
- [x] **B.5.2** Generate Drizzle migration `drizzle/0002_milky_azazel.sql` — `DROP TABLE documents_title`
- [x] **B.5.3** Remove `migrateDocumentsTitle()` and `getAssetDocumentsDbPath()` from `src/main/database/migrate-from-nedb.ts`
- [x] **B.5.4** Remove `getAllTitles()` / `insertTitle()` from `src/main/database/repositories/documents.repository.ts`; keep custom documents functions
- [x] **B.5.5** Rewire `documents:getTitles` IPC handler to return `SermonMeta[]` via `sermonMetadataRepo.getSermonList('en')` (TODO: use active language from config)
- [x] **B.5.6** Update `InvokeChannelMap` — `getTitles` returns `SermonMeta[]` instead of `Title[]`
- [x] **B.5.7** Mark `Title` type as `@deprecated` in `src/shared/types.ts` (still used by legacy renderer code)
- [x] **B.5.8** Update renderer sidebar to use new preload API (`window.api.documents.getTitles()`)
- [x] **B.5.9** Update `DocumentTitle` model to wrap `SermonMeta` instead of `Title`
- [x] **B.5.10** Update Recoil `titlesStore` to hold `SermonMeta[]`
- [x] **B.5.11** Remove traduction dropdown filter from sidebar search (obsolete with per-language data)
- [x] **B.5.12** Remove legacy title tests from `documents.repository.test.ts`
- [x] **B.5.13** Update `specs/DATA-MIGRATION.md` to reflect removal of `documents-title.db`

---

## Phase C: IPC Wiring

Wire the new services into IPC handlers so the renderer can access them.

### C.1 — New IPC Types

- [x] **C.1.1** Add new types to `src/shared/types.ts`:
    - ~~`SermonMeta`~~ ✅ (done in Phase B.5)
    - `SermonContent` — meta: SermonMeta, paragraphs: Paragraph[]
    - `SermonParagraph` — lineIndex, paragraphIndex, content (unstemmed_content)
    - `InstalledLanguage` — code, language, sermonsCount, sizeOnDisk
    - `DownloadableLanguage` — code, language, sermonsAvailable, sermonsWithAudio, filesize, installed
    - `TantivySearchResult` — hits: TantivySearchHit[], total: number, query: string
    - `TantivySearchHit` — translationId, sermonDate, title, snippet, score
    - `LanguageDownloadProgress` — langCode, percentage
- [x] **C.1.2** Add new channel definitions to `src/shared/ipc.types.ts`:
    - `LanguageChannels` — getInstalled, getAvailable, install, delete
    - Add `documents:getSermonContent`, `documents:getSermonList`, `documents:getSermonsByYear`, `documents:getTranslations`
    - Add push channels: `push:languageDownloadProgress`, `push:languageInstalled`
- [x] **C.1.3** Update `InvokeChannelMap` and `PushEventMap` with new types

### C.2 — IPC Handlers

- [x] **C.2.1** Create `src/main/ipc/languages.ipc.ts`:
    - `languages:getInstalled` → `languagePackService.getInstalledLanguages()`
    - `languages:getAvailable` → `languagePackService.getDownloadableLanguages()`
    - `languages:install` → `languagePackService.downloadLanguagePack(langCode, progress => sendToRenderer(...))`
    - `languages:delete` → `languagePackService.deleteLanguagePack(langCode)`
- [x] **C.2.2** Update `src/main/ipc/documents.ipc.ts`:
    - `documents:getTitles` → `sermonMetadataRepo.getSermonList(langCode)` (now accepts langCode arg)
    - `documents:getSermonContent` → `tantivyService.getSermonParagraphs(langCode, translationId)` + metadata
    - `documents:getSermonList` → `sermonMetadataRepo.getSermonList(langCode, options)`
    - `documents:getSermonsByYear` → `sermonMetadataRepo.getSermonsByYear(langCode)`
    - `documents:getTranslations` → `sermonMetadataRepo.getAvailableTranslations(translationId)`
    - Removed `documents:getContentPath` stub
- [x] **C.2.3** Update `src/main/ipc/search.ipc.ts`:
    - `search:searchText` → `tantivyService.searchSermons(langCode, query, limit, offset)`
    - `search:searchContent` → `tantivyService.getSearchSnippet(langCode, query, translationId)`
- [x] **C.2.4** Update preload (`src/preload/index.ts`):
    - Add `languages` namespace with all language IPC calls
    - Update `documents` namespace with new sermon content methods
    - Add push event listeners for language download progress
- [x] **C.2.5** Register `registerLanguageHandlers()` in `src/main/ipc/register.ts`

### C.3 — Config Updates

- [x] **C.3.1** Add `activeLanguage` field to `configurations` table (migration `0003_freezing_starfox.sql`)
- [x] **C.3.2** Add `getActiveLanguage()` / `setActiveLanguage(langCode)` to config repository
- [x] **C.3.3** Added `app:getActiveLanguage` / `app:setActiveLanguage` IPC channels (renderer fetches separately)

### C.4 — Verification

- [x] **C.4.1** `pnpm typecheck` — 0 errors
- [x] **C.4.2** `pnpm build` — builds successfully
- [ ] **C.4.3** Manual test: app boots, can call new IPC channels from devtools console

---

## Phase D: Renderer — Sermon View & Language UI

Replace the iframe-based document view with native React paragraph rendering.

### D.1 — Zustand Stores

- [x] **D.1.1** Language state lives in `app.store.ts` (`activeLanguage`, `setActiveLanguage`) — no separate language store needed; `LanguageSelector` component handles language switching directly via IPC
- [x] **D.1.2** `src/renderer/stores/sermon.store.ts` already created:
    - `sermons: SermonMeta[]`, `sermonsByTitle`, `sermonsByYear`
    - `activeContent: SermonContent | null`, `setActiveContent()`
    - `tabs: DocumentTab[]` with add/remove/activate/reorder/scroll/zoom
- [x] **D.1.3** `src/renderer/stores/search.store.ts` — `documentViewQueries` used for in-document search; Tantivy results consumed directly in search view component state

### D.2 — Sidebar Documents

- [x] **D.2.1** `LanguageSelector` component in sidebar header — shows installed languages with counts, gear button opens language manager modal, persists selection via `app:setActiveLanguage` IPC
- [x] **D.2.2** `DocumentSearch` component loads sermons via `window.api.documents.getTitles()`, client-side title filter, traduction filter removed
- [x] **D.2.3** `DocumentByYears` — reads from `useSermonStore((s) => s.sermonsByYear)`, populated when `DocumentSearch` reloads sermons on language change
- [x] **D.2.4** `DocumentByAlphabetic` — reads from `useSermonStore((s) => s.sermons)`, same reactive pattern
- [x] **D.2.5** `DocumentsAdded` (custom documents) — unchanged (language-independent)

### D.3 — Sermon View Component

- [x] **D.3.1** Rewrote `src/renderer/views/document-view.tsx` — iframe → React paragraphs:
    - `useSermonContent()` — loads paragraphs via `getSermonContent` IPC
    - `useScrollAndZoom()` — scroll/zoom persistence per tab
    - `SermonHeader` — title, date, zoom, search, translations, audio buttons
    - `SermonParagraphView` — memoized, renders `<p>` with line numbers
    - `useContextMenu()` — "Ajouter au sujet" / "Ajouter à la note"
- [x] **D.3.2** Search highlight via `useSearchHighlight()` — reads `documentViewQueries` from store, highlights matches with `<mark>` using `simpleRegExp`
- [x] **D.3.3** Subject navigation via `useSubjectNavigation()` — scrolls to `[data-paragraph-index]` when `selectedSubjectItem` is set
- [x] **D.3.4** Audio player integration — `SermonHeader` dispatches `audioDocumentPlay` event with legacy `Title` shape built from `SermonMeta`

### D.4 — Tab System (framer-motion Reorder)

- [x] **D.4.1** `framer-motion` v12.35.0 already installed
- [x] **D.4.2** `DocumentTab` type in `src/shared/types.ts` — `title`, `scrollY`, `scrollX`, `zoom`, `active` (title-based, no `translationId` field needed — title is unique per tab)
- [x] **D.4.3** `src/renderer/components/document-tabs.tsx` — already rewritten with `Reorder.Group`/`Reorder.Item`, active state styling, close button, max 6 tabs
- [x] **D.4.4** Tab switching handled by `activateTab(title)` — sermon view re-renders with new `activeContent`
- [x] **D.4.5** `useOpenDocument` hook in `src/renderer/hooks/index.ts` — `addTab(title)` + `setMainView('document')`
- [x] **D.4.6** Legacy `chrome-tabs/` directory already deleted, `draggabilly` already removed

### D.5 — Language Management Modal

- [x] **D.5.1** Created `src/renderer/views/components/modals/language-manager-modal.tsx`:
    - Lists installed languages with size, sermon count, and "Delete" button
    - Lists downloadable languages with "Install" button
    - Download progress circle per language
    - Listens to `push:languageDownloadProgress` and `push:languageInstalled` events
    - Added to `content-app.tsx`, triggered via `LANGUAGE_EVENT.openLanguageManager`
    - LanguageSelector updated with gear button to open manager

### D.6 — Search View Updates

- [x] **D.6.1** Updated `src/renderer/views/options/search.tsx`:
    - Consumes `TantivySearchResult` with `hit.snippet` (HTML via `dangerouslySetInnerHTML`)
    - Removed `ContentItem`, `MatcherFn`, manual DOM highlighting
    - Pagination via `results.total` with `ITEMS_PER_PAGE = 20`
    - Click result sets `documentViewQuery` with search term
- [x] **D.6.2** Search suggestions unchanged (SQLite-backed)

### D.7 — Other Traductions Modal

- [x] **D.7.1** Updated `other-traductions-modal.tsx`:
    - Fetches translations via `window.api.documents.getTranslations(translationId)`
    - Lists available languages with "Ouvrir" button
    - Clicking opens the translation via `useOpenDocument`
    - Uses `open` prop (antd v5+) instead of deprecated `visible`

### D.8 — Cleanup Legacy Components

- [x] **D.8.1** Rewrote `document-view.tsx` in-place (no separate `sermon-view.tsx` — same file, new implementation)
- [x] **D.8.2** `modules/documents/` already deleted in prior Phase D work
- [x] **D.8.3** Removed from `src/renderer/utils/events.ts`: `POST_MESSAGE_EVENT`, `PARENT_WINDOW_EVENT`, `CHILD_WINDOW_EVENT`, `DOCUMENT_CONTENT_ID`
- [x] **D.8.3b** Removed dead `CHILD_PARENT_WINDOW_EVENT` entries: `closeDocumentQuery`, `documentCurrentZoom`, `documentViewLoaded`, `openDocumentExternalLink`, `emptySearchquery`
- [x] **D.8.3c** Kept `downloadDocumentPdf` (used by `pdf-document-downloader.tsx`)
- [x] **D.8.3d** Added `LANGUAGE_EVENT = { openLanguageManager }` to events
- [x] **D.8.4** Removed `TRADUCTIONS` constant from `src/renderer/utils/constants.ts`; `document-audio-player.tsx` now displays `languageCode` directly
- [x] **D.8.5** `DocumentTitle` model and Recoil atoms already deleted in prior Phase D work
- [x] **D.8.6** Recoil atoms already deleted in prior Phase D work
- [x] **D.8.7** Legacy tab system replaced with framer-motion `Reorder` in `document-tabs.tsx`
- [x] **D.8.8** All legacy iframe hooks removed from `document-view.tsx`:
    - `usePostMessage`, `useDocumentQuery`, `useSubjectQuery`, `useSearchQuery`
    - `useDocumentsState`, `useOpenDocumentExternalLink`, `useAlertFromIframe`
    - `useToPostMessageCurrentAudioDocumentPlay`

### D.9 — Verification

- [x] **D.9.1** `pnpm typecheck` — 0 errors
- [x] **D.9.2** `pnpm lint` — 0 errors in changed files (2 pre-existing errors in `mediaelement.tsx`, 66 pre-existing warnings)
- [x] **D.9.3** `pnpm build` — builds successfully (fixed missing `@ckeditor/ckeditor5-react` v5.0.2)
- [ ] **D.9.4** Manual test: install a language, see sermons in sidebar, click sermon, view paragraphs, search works, tabs work

---

## Phase E: First Launch & Setup Screen

### E.1 — Setup Flow

- [ ] **E.1.1** Create `src/renderer/views/setup/setup-view.tsx`:
    - Fetch and display available languages from `index.json`
    - Language cards with: name, sermon count, audio count, download size
    - Checkbox selection + "Install Selected" button
    - Download progress per language
    - "Continue to App" button when at least 1 language installed
- [ ] **E.1.2** Create `src/renderer/views/setup/setup-store.ts`:
    - `availableLanguages`, `selectedLanguages`, `downloadingLanguage`, `progress`
- [ ] **E.1.3** Update `App.tsx` / root component:
    - On startup, check if any languages installed
    - If none: show `SetupView` instead of main layout
    - After setup: transition to main app

### E.2 — Bible Download

- [ ] **E.2.1** Add Bible data to `index.json` manifest (already spec'd)
- [ ] **E.2.2** Bible download included in setup flow (auto-selected based on language)
- [ ] **E.2.3** Unzip Bible SQLite to `databases/bible.sqlite`

### E.3 — NeDB Migration Integration

- [ ] **E.3.1** On upgrade detection (legacy NeDB files exist):
    - Run existing `migrate-from-nedb.ts` for app data (notes, subjects, etc.)
    - Show message: "Your data has been migrated. Please install language packs."
    - Direct to setup screen for language installation
- [ ] **E.3.2** Handle `DocumentHtmlTree` references in migrated data:
    - Mark migrated references with `legacyTree: true` flag
    - In sermon view, show "Legacy reference" indicator for these

### E.4 — Verification

- [ ] **E.4.1** Fresh install: app shows setup screen, can install languages, transitions to main app
- [ ] **E.4.2** Upgrade from v1.0.0: NeDB data migrated, prompted to install languages
- [ ] **E.4.3** `pnpm typecheck` — 0 errors

---

## Phase F: Reference System Migration

Update notes and subjects to use paragraph-based references instead of DOM tree paths.

### F.1 — Type Updates

- [ ] **F.1.1** Add `ParagraphReference` type to `src/shared/types.ts`:
    ```typescript
    type ParagraphReference = {
        paragraphIndex: number;
        translationId: number;
        languageCode: string;
        textSnippet?: string;
    };
    ```
- [ ] **F.1.2** Update `NoteItemReference` — `documentHtmlTree` becomes `documentHtmlTree | ParagraphReference` (support both during transition)
- [ ] **F.1.3** Update `SubjectDocumentItem` — same dual support

### F.2 — Creating New References

- [ ] **F.2.1** Update note reference creation in sermon view:
    - User selects text in a paragraph → creates `ParagraphReference` with `paragraphIndex`, `translationId`, selected text snippet
    - No more DOM tree traversal
- [ ] **F.2.2** Update subject item creation — same pattern
- [ ] **F.2.3** Update reference display in notes/subjects panels:
    - `ParagraphReference`: show "Paragraph N of [Sermon Title]" with snippet
    - `DocumentHtmlTree` (legacy): show "Legacy reference from [Document Title]"

### F.3 — Context Menu

- [ ] **F.3.1** Create context menu for sermon view paragraphs:
    - "Add to Notes" — creates note reference
    - "Add to Subject" — opens subject selection modal
    - "Copy Text" — copies paragraph text
- [ ] **F.3.2** Remove legacy `modules/documents/context-menu.js`

### F.4 — Verification

- [ ] **F.4.1** Create a new note reference from sermon view — verify it uses `ParagraphReference`
- [ ] **F.4.2** Legacy references still display (with indicator)
- [ ] **F.4.3** `pnpm test` — all tests pass

---

## Phase G: Index Generation & Release Pipeline

Create tooling to build Tantivy indexes from source data and publish to GitHub releases.

### G.1 — Index Builder Script

- [ ] **G.1.1** Create `scripts/build-index.ts` (run outside Electron, Node.js CLI):
    - Input: directory of HTML sermon files + `documents-title.db`
    - Parse each HTML file into paragraphs (strip tags, preserve paragraph numbers)
    - Create Tantivy index with schema: `sermon_date(i64)`, `line_index(u64)`, `paragraph_index(u64)`, `translation_id(u64)`, `unstemmed_content(text)`, optional `stemmed_content(text)`
    - Assign `translation_id` by matching sermon date across languages
    - Output: Tantivy index directory ready to ZIP
- [ ] **G.1.2** Generate `index.json` manifest from built indexes (file sizes, checksums, sermon counts)
- [ ] **G.1.3** Add `pnpm build:index -- --lang=fr --input=./data/fr/` script

### G.2 — French Index

- [ ] **G.2.1** Build French Tantivy index from `tmp/old-data/datas/documents/` (1,769 HTML files)
- [ ] **G.2.2** Map `documents-title.db` dates to `sermon_date` integers
- [ ] **G.2.3** Assign `translation_id` matching English index (by `sermon_date` + `enTitle`)
- [ ] **G.2.4** Verify: French index opens, search works, paragraphs match original HTML content

### G.3 — Release Publishing

- [ ] **G.3.1** Upload `index.json` + all `index-*.zip` + `bible-*.zip` to GitHub release v1.0.0
- [ ] **G.3.2** Verify: app can download and install language packs from release

---

## Phase H: Testing & Polish

### H.1 — Integration Tests

- [ ] **H.1.1** Test full flow: fresh install → setup → install English → browse sermons → search → open sermon → view paragraphs
- [ ] **H.1.2** Test language management: install second language → switch → verify different sermon list
- [ ] **H.1.3** Test search across languages
- [ ] **H.1.4** Test upgrade path: NeDB data → SQLite migration → language install → verify notes/subjects preserved

### H.2 — Component Tests

- [ ] **H.2.1** `sermon-view.tsx` — renders paragraphs, handles scroll, handles zoom
- [ ] **H.2.2** `setup-view.tsx` — shows languages, handles download
- [ ] **H.2.3** `language-manager-modal.tsx` — install/delete flows
- [ ] **H.2.4** Updated sidebar components — language selector, sermon list

### H.3 — Performance

- [ ] **H.3.1** Verify Tantivy search latency < 50ms for typical queries
- [ ] **H.3.2** Verify sermon paragraph loading < 100ms (even for 400+ paragraph sermons)
- [ ] **H.3.3** Verify sidebar sermon list renders smoothly with 1,700+ items (virtualized list if needed)

### H.4 — Final Cleanup

- [ ] **H.4.1** Remove `tmp/old-data/` directory from repo
- [ ] **H.4.2** Remove legacy HTML document references from codebase
- [ ] **H.4.3** Update `.gitignore` for `indexes/` and `databases/` in dev
- [ ] **H.4.4** Update `specs/TASKS.md` Phase 3/4/5 to reference new data architecture
- [ ] **H.4.5** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all pass

---

## Summary

| Phase | Description                         | Key Deliverable                         | Status |
| ----- | ----------------------------------- | --------------------------------------- | ------ |
| A     | Library swap & Tantivy service      | Read Tantivy indexes, search sermons    | ✅     |
| B     | Sermon metadata & language packs    | Download language packs, build metadata | ✅     |
| C     | IPC wiring                          | Renderer can access sermons and search  | ✅     |
| D     | Renderer: sermon view & language UI | Native paragraph rendering, no iframe   | ✅     |
| E     | First launch & setup screen         | User-driven language installation       |        |
| F     | Reference system migration          | Paragraph-based notes/subject refs      |        |
| G     | Index generation & release pipeline | Build & publish Tantivy indexes         |        |
| H     | Testing & polish                    | Full integration testing, performance   |        |
