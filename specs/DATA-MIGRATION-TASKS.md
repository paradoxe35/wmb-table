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

- [x] **A.3.1** Create `tests/unit/main/services/tantivy.service.test.ts` — integration tests requiring real Tantivy indexes:
    - Rewritten in Phase F.6.2: env-driven via `TANTIVY_TEST_INDEXES`, skips cleanly without index data
    - Tests: installed languages, ordered paragraphs, search results, HTML snippet highlights
- [x] **A.3.2** Verify: `pnpm test` passes, `pnpm typecheck` 0 errors, `pnpm build` succeeds

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

## Phase B.6: Language Index Architecture Redesign ✅

Redesign language index resolution with offline fallback, caching, and dual download sources.

### B.6.1 — Bundled Language Index

- [x] **B.6.1.1** Add `langCode` field to all 68 entries in `resources/languages-index.json`
- [x] **B.6.1.2** Add `resources/languages-index.json` to `extraResources` in `package.json` build config

### B.6.2 — Shared Types

- [x] **B.6.2.1** Add `enLanguage: string` to `InstalledLanguage` interface in `src/shared/types.ts`
- [x] **B.6.2.2** Add `enLanguage: string` to `DownloadableLanguage` interface in `src/shared/types.ts`

### B.6.3 — Language Pack Service Rewrite

- [x] **B.6.3.1** Replace `Manifest`/`ManifestLanguage`/`ManifestBible` types with `LanguageIndexEntry`
- [x] **B.6.3.2** Implement three-tier `getLanguageIndex()`: cache → bundled → remote
- [x] **B.6.3.3** Implement dual-source download in `downloadLanguagePack()`: primary (57.129.42.228) → fallback (GitHub)
- [x] **B.6.3.4** Update `getInstalledLanguages()` to resolve `language`/`enLanguage` from index
- [x] **B.6.3.5** Update `getDownloadableLanguages()` to use `getLanguageIndex()` with `enLanguage`
- [x] **B.6.3.6** Remove old types (`ManifestLanguage`, `ManifestBible`, `Manifest`), `MANIFEST_URL`, `fetchManifest()`, `verifyChecksum()`

### B.6.4 — Renderer Updates

- [x] **B.6.4.1** Show `enLanguage` in language manager modal list items (e.g., "Français (French)")

### B.6.5 — Specs & Documentation

- [x] **B.6.5.1** Update `specs/DATA-MIGRATION.md` Section 3: manifest → language index format, three-tier resolution, dual download
- [x] **B.6.5.2** Add Phase B.6 tasks to `specs/DATA-MIGRATION-TASKS.md`

### B.6.6 — Dataset Analysis

- [x] **B.6.6.1** Download French language pack to `tmp/tantivy/index-fr.zip`
- [x] **B.6.6.2** Create `tmp/tantivy/analyze-index.js` — Node.js script to analyze Tantivy index structure

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

## Phase D.10: Reference Database Integration (data.sqlite) ✅

Replace `sermon_metadata` user DB table with bundled `data.sqlite` as single source of truth for all reference data.

### D.10.1 — Reference DB Infrastructure

- [x] **D.10.1.1** Create `src/main/database/reference-db.ts` — open `resources/database/data.sqlite` read-only with mmap
- [x] **D.10.1.2** Wire into `src/main/database/index.ts` — init/close lifecycle
- [x] **D.10.1.3** Update `package.json` extraResources — add `resources/database` dir, remove `languages-index.json`

### D.10.2 — Reference Repository

- [x] **D.10.2.1** Create `src/main/database/repositories/reference.repository.ts`:
    - Language queries: `getAllLanguages`, `getLanguageByCode`, `getLanguageByIsarId`
    - Sermon queries: `getAllSermons`, `getSermonById`, `getSermonByIsarId`
    - Translation queries: `getTranslationsForLanguage`, `getTranslationsForSermon`, `getTranslationCountForLanguage`
    - Translator queries: `getTranslatorsForLanguage`
    - Audio queries: `getAudioForSermonByIds`, `getAudioCountForLanguage`
    - Mapping helpers: `sermonIdToTantivyDate`, `tantivyDateToSermonIds`

### D.10.3 — Reference Data Service

- [x] **D.10.3.1** Create `src/main/services/reference-data.service.ts`:
    - `getSermonListForLanguage(langCode)` — English: sermon table, others: translation JOIN
    - `getSermonListDeduplicated(langCode)` — group by sermon, attach `availableTraductions`
    - `getSermonMeta(translatorId, langCode, sermonDate?)` — single lookup
    - `getTraductionsForSermon(sermonDate, langCode)` — within-language translations
    - `getTranslationsForSermon(sermonId)` — cross-language translations
    - `getSermonsByYear(langCode)` — grouped by year
- [x] **D.10.3.2** Delete `src/main/services/sermon-metadata.service.ts`

### D.10.4 — Simplify Tantivy Service

- [x] **D.10.4.1** Remove `getUniqueSermonDates()`, `getTraductions()`, `getTraductionsForDate()`, `sermonDatesCache`
- [x] **D.10.4.2** Keep: content retrieval, search, paragraph count, installed languages

### D.10.5 — Rewrite Language Pack Service

- [x] **D.10.5.1** Use `refRepo.getLanguageByCode()` for download URLs (no more JSON index)
- [x] **D.10.5.2** Use `refRepo.getAllLanguages()` for downloadable list
- [x] **D.10.5.3** Remove metadata build from download flow
- [x] **D.10.5.4** Delete `resources/languages-index.json`

### D.10.6 — Update IPC & Preload

- [x] **D.10.6.1** `documents.ipc.ts` → reference-data.service + reference.repository
- [x] **D.10.6.2** `search.ipc.ts` → reference-data.service for meta lookups
- [x] **D.10.6.3** `getSermonContent` now takes `(langCode, translationId, sermonDate)` — 3 args
- [x] **D.10.6.4** `getTranslations` now takes `sermonId: string` (not translationId)
- [x] **D.10.6.5** Updated `src/preload/index.ts` and `src/shared/ipc.types.ts`

### D.10.7 — Drop sermon_metadata from User DB

- [x] **D.10.7.1** Remove `sermonMetadata` from `src/main/database/schema.ts`
- [x] **D.10.7.2** Generated migration `drizzle/0005_common_banshee.sql` — DROP TABLE
- [x] **D.10.7.3** Delete `src/main/database/repositories/sermon-metadata.repository.ts`

### D.10.8 — Update Shared Types

- [x] **D.10.8.1** Added `RefLanguage`, `RefSermon`, `RefTranslator` types
- [x] **D.10.8.2** Rewrote `SermonMeta`: replaced `pdfLink`/`webLink`/`dateLong`/`paragraphCount` with `dateMs`/`minutes`/`location`
- [x] **D.10.8.3** Removed obsolete types: `OtherTraduction`, `TraductionInfo`, `Title`, `DataDocument`, `SearchItem`, `SearchResult`

### D.10.9 — Update Renderer

- [x] **D.10.9.1** `document-view.tsx`: pass `sermonDate` to `getSermonContent`, show location/minutes
- [x] **D.10.9.2** `other-traductions-modal.tsx`: `getTranslations(sermonDate)` instead of `getTranslations(translationId)`
- [x] **D.10.9.3** No changes needed: `sermon.store.ts`, `sidebar-documents.tsx`, `LanguageSelector.tsx`, `hooks/index.ts`

### D.10.10 — Tests

- [x] **D.10.10.1** Created `reference.repository.test.ts` — 13 tests against real data.sqlite
- [x] **D.10.10.2** Rewrote `language-pack.service.test.ts` — 2 tests with real data.sqlite
- [x] **D.10.10.3** Updated `tantivy.service.test.ts` — removed `getUniqueSermonDates` references
- [x] **D.10.10.4** Deleted `sermon-metadata.repository.test.ts` and `sermon-metadata.service.test.ts`

### D.10.11 — Verification

- [x] **D.10.11.1** `pnpm typecheck` — 0 errors
- [x] **D.10.11.2** `pnpm build` — succeeds
- [x] **D.10.11.3** `pnpm test` — 61 passed, 7 skipped (test fixes applied in Phase F.6)

---

## Phase D.11: Sidebar Document List Redesign ✅

Redesign the sidebar document list with a rich two-column layout and city/state data pipeline.

### D.11.1 — Types & Data Pipeline

- [x] **D.11.1.1** Add `cityState: string | null` to `SermonMeta` in `src/shared/types.ts`
- [x] **D.11.1.2** Add `cityState: string | null` to `RefSermon` in `src/shared/types.ts`
- [x] **D.11.1.3** Add city/state JOINs (`sermon → location → city → state`) to all sermon queries in `reference.repository.ts`
- [x] **D.11.1.4** Update `reference-data.service.ts` to pass `cityState` through to `SermonMeta`

### D.11.2 — Sidebar Component Redesign

- [x] **D.11.2.1** Redesign `ItemOutline` component in `sidebar-documents.tsx` with two-column layout:
    - Left: title (bold), English subtitle (for non-English), formatted date, traduction badges
    - Right: city/state (e.g. "Jeffersonville, IN"), audio icon
- [x] **D.11.2.2** Create `formatSermonDate()` utility in `src/renderer/utils/sermon-utils.ts`
- [x] **D.11.2.3** Add `.sidebar-item` CSS layout in `app.global.scss`

### D.11.3 — Tests

- [x] **D.11.3.1** Add cityState assertions to `reference.repository.test.ts`

---

## Phase E: First Launch, Setup Screen & Bible Architecture ✅

### E.1 — Bible Architecture

- [x] **E.1.1** Create `resources/database/bible-index.json` — Bible version index
- [x] **E.1.2** Build `resources/database/bible.fr-lsg.sqlite` — Louis Segond (31,102 verses + FTS5, from legacy NeDB data)
- [x] **E.1.3** Create `src/main/services/bible.service.ts`:
    - `loadBibleIndex()`, `getBibleVersionsForLanguage()`, `getAllBibleVersions()`
    - `switchBibleForLanguage()` — close current, open new (fallback: lang → en → first available)
    - `switchBibleVersion(abbreviation)` — switch to specific version
    - `downloadBibleVersion(abbreviation, onProgress)` — download remote Bible from GitHub
    - `isBibleAvailable(version)` — check if local/remote file exists
    - `getActiveBibleDb()`, `getActiveVersion()`, `closeBibleDb()`
    - `_setBibleDbForTesting()` for tests
    - `type: 'local' | 'remote'` — local bundled in resources, remote downloaded to userData
- [x] **E.1.4** Update `src/main/database/index.ts`:
    - Remove user-dir `bible.sqlite` creation + FTS5 setup
    - Delegate to `bibleService.switchBibleForLanguage()` during init
    - `getBibleDb()` / `getBibleSqlite()` delegate to bible.service
    - `switchBibleLanguage()` exported for IPC handler use
- [x] **E.1.5** Switch Bible DB when language changes:
    - `app:setActiveLanguage` IPC handler calls `switchBibleLanguage(langCode)`
- [x] **E.1.6** Add `BibleVersionInfo` type to `src/shared/types.ts`
- [x] **E.1.7** Add IPC channels to `ipc.types.ts`:
    - `bible:getVersions`, `bible:getAllVersions`, `bible:getActiveVersion`
    - `bible:switchVersion`, `bible:downloadVersion`
    - `push:bibleDownloadProgress`, `push:bibleDownloaded`
- [x] **E.1.8** Update `src/main/ipc/bible.ipc.ts` — version, switch, download handlers
- [x] **E.1.9** Update `src/preload/index.ts` — full Bible version API + push listeners
- [x] **E.1.10** Update `bible.repository.ts` — graceful empty returns when no Bible is loaded
- [x] **E.1.11** Update `notes.repository.ts` — graceful null when no Bible for `addBibleVerse`
- [x] **E.1.12** Update `bible.tsx` — version selector bar, graceful "no Bible" empty state, version switching + remote download UI

### E.2 — Setup Screen

- [x] **E.2.1** Add `needsSetup` state to `app.store.ts`
- [x] **E.2.2** Create `src/renderer/stores/setup.store.ts`:
    - `availableLanguages`, `selectedLanguages`, `downloadingLanguage`, `downloadProgress`, `installedLanguages`
- [x] **E.2.3** Create `src/renderer/views/setup/setup-view.tsx`:
    - Language grid with checkbox cards (name, native name, sermon count, download size)
    - "Install" button, per-language download progress
    - "Continue to App" button when at least 1 language installed
- [x] **E.2.4** Update `content-app.tsx` — setup gate (`if (needsSetup) return <SetupView />`)
- [x] **E.2.5** Update `useInitApp()` in `src/renderer/hooks/index.ts`:
    - Check installed languages first
    - If none → `setNeedsSetup(true)`, skip loading sermons
    - Re-runs when `needsSetup` changes to false (after setup completion)
- [x] **E.2.6** Post-setup flow: set active language, initialize, `setNeedsSetup(false)` triggers re-init

### E.3 — NeDB Migration Update

- [x] **E.3.1** Remove `migrateBible()` from `migrate-from-nedb.ts` — Bible data now comes from bundled files
- [x] **E.3.2** Remove `getAssetBiblePath()` helper
- [x] **E.3.3** Remove `getBibleSqlite` import (no longer needed)
- [x] **E.3.4** Keep all other migrations (notes, subjects, history, tabs, etc.)

### E.4 — Verification

- [x] **E.4.1** `pnpm typecheck` — 0 errors
- [x] **E.4.2** `pnpm build` — succeeds
- [x] **E.4.3** `pnpm test` — 61 passed, 7 skipped (addBibleVerse test fixed in Phase F.6.1, tantivy skipped without index data)
- [ ] **E.4.4** Fresh install → setup screen, install language, Bible auto-available, transition to app
- [ ] **E.4.5** Language switch → Bible DB switches to matching version (or fallback)

---

## Phase F: Reference System Migration ✅

Replace `DocumentHtmlTree` with `ParagraphReference` for notes/subjects. Support both formats for backward compatibility with existing stored data.

### F.1 — Type Updates

- [x] **F.1.1** Add `ParagraphReference` type to `src/shared/types.ts`:
    - `paragraphIndex: number`, `translationId: number`, `languageCode: string`, `textSnippet?: string`
- [x] **F.1.2** Add `isParagraphReference()` type guard to `src/shared/types.ts`
- [x] **F.1.3** Widen `NoteItemReference.documentHtmlTree` to `DocumentHtmlTree | ParagraphReference`
- [x] **F.1.4** Widen `SubjectDocumentItem.documentHtmlTree` to `DocumentHtmlTree | ParagraphReference`
- [x] **F.1.5** Widen `SubjectRefTree.documentHtmlTree` to `DocumentHtmlTree | ParagraphReference`

### F.2 — IPC Type Fixes

- [x] **F.2.1** Fix `syncReferences` IPC args: `SubjectRefTree[]` → `string[]` (matches what editor actually sends — reference IDs)
- [x] **F.2.2** Widen `createReference` IPC args to accept `DocumentHtmlTree | ParagraphReference`
- [x] **F.2.3** Widen `createItem` (subjects) IPC args to accept `DocumentHtmlTree | ParagraphReference`
- [x] **F.2.4** Import `ParagraphReference` in `src/shared/ipc.types.ts`, remove unused `SubjectRefTree` import

### F.3 — Context Menu (document-view.tsx)

- [x] **F.3.1** "Ajouter au sujet" now emits `ParagraphReference` with `paragraphIndex`, `translationId`, `languageCode`, `textSnippet`
- [x] **F.3.2** "Ajouter à la note" — same `ParagraphReference` treatment
- [x] **F.3.3** `useSubjectNavigation` handles both legacy `tree[0]` and new `paragraphIndex` via `isParagraphReference()`

### F.4 — Repository Layer

- [x] **F.4.1** `notes.repository.ts` — `syncReferences(noteId, refIds: string[])`: delete refs not in ID list (no re-insert)
- [x] **F.4.2** `notes.repository.ts` — `createReference` accepts `DocumentHtmlTree | ParagraphReference`
- [x] **F.4.3** `subjects.repository.ts` — `createItem` accepts `DocumentHtmlTree | ParagraphReference`

### F.5 — Display Updates

- [x] **F.5.1** `references.tsx` — `useShowReferenceDetail` `assigned` check handles both ref shapes
- [x] **F.5.2** `note-references-modal.tsx` — `assigned` check handles both ref shapes, widened `documentRefTree` ref type
- [x] **F.5.3** No schema changes — SQLite `document_html_tree TEXT` column stores JSON of either shape

### F.6 — Test Fixes

- [x] **F.6.1** Fixed `addBibleVerse` test: set up Bible test DB via `createTestBibleDb()`, insert test verse, pass `verseId` string (not object)
- [x] **F.6.2** Fixed `tantivy.service.test.ts`: removed hardcoded `tmp/` paths, uses `TANTIVY_TEST_INDEXES` env var, skips cleanly when index data unavailable

### F.7 — Verification

- [x] **F.7.1** `pnpm typecheck` — 0 errors
- [x] **F.7.2** `pnpm build` — succeeds
- [x] **F.7.3** `pnpm test` — 61 passed, 7 skipped, 0 failures (tantivy suite skipped without index data)
- [ ] **F.7.4** Manual: new subject reference from sermon view → stores `ParagraphReference` with `translationId`/`languageCode`
- [ ] **F.7.5** Manual: new note reference from sermon view → same
- [ ] **F.7.6** Manual: existing legacy references still display and navigate correctly
- [ ] **F.7.7** Manual: note editor empty → assigned reference flow still works

---

## Phase G: Index Generation & Release Pipeline

Create tooling to build Tantivy indexes from source data and publish to GitHub releases.

### G.1 — Index Builder Script

- [ ] **G.1.1** Create `scripts/build-index.ts` (run outside Electron, Node.js CLI):
    - Input: directory of HTML sermon files; sermon metadata from `data.sqlite` (sermon IDs, dates, translation IDs via `refRepo`)
    - Parse each HTML file into paragraphs (strip tags, preserve paragraph numbers)
    - Create Tantivy index with schema: `sermon_date(i64)`, `line_index(u64)`, `paragraph_index(u64)`, `translation_id(u64)`, `unstemmed_content(text)`, optional `stemmed_content(text)`
    - Assign `translation_id` from `data.sqlite` `translator.translator_id` (matches Tantivy `translation_id`)
    - Output: Tantivy index directory ready to ZIP
- [ ] **G.1.2** Add `pnpm build:index -- --lang=fr --input=./data/fr/` script

### G.2 — French Index

- [x] **G.2.1** French Tantivy index already exists as downloadable language pack — `data.sqlite` has all French metadata (translations, translators SHP/VGR)
- [ ] **G.2.2** Verify: French index opens, search works, paragraphs match sermon content

### G.3 — Release Publishing

- [ ] **G.3.1** Upload all `index-*.zip` + `bible-*.zip` to GitHub release (no `index.json` manifest — download URLs derived from `data.sqlite` `language` table fields)
- [ ] **G.3.2** Verify: app can download and install language packs from release

---

## Summary

| Phase | Description                         | Key Deliverable                                    | Status |
| ----- | ----------------------------------- | -------------------------------------------------- | ------ |
| A     | Library swap & Tantivy service      | Read Tantivy indexes, search sermons               | ✅     |
| B     | Sermon metadata & language packs    | Download language packs, build metadata            | ✅     |
| B.6   | Language index redesign             | 3-tier resolution, dual download, offline fallback | ✅     |
| C     | IPC wiring                          | Renderer can access sermons and search             | ✅     |
| D     | Renderer: sermon view & language UI | Native paragraph rendering, no iframe              | ✅     |
| D.10  | Reference DB integration            | data.sqlite replaces sermon_metadata + JSON index  | ✅     |
| D.11  | Sidebar document list redesign      | Rich two-column layout with city/state pipeline    | ✅     |
| E     | First launch, setup & Bible arch.   | Bundled Bible, setup screen, no NeDB bible         | ✅     |
| F     | Reference system migration          | Paragraph-based notes/subject refs                 | ✅     |
| G     | Index generation & release pipeline | Build & publish Tantivy indexes                    |        |
| H     | Testing & polish                    | Full integration testing, performance              |        |
