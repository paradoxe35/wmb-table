# WMB Table — Data Migration Task List

Step-by-step execution plan for the data migration described in [DATA-MIGRATION.md](./DATA-MIGRATION.md).

Each phase produces a working (or at least buildable) application before proceeding to the next.

**Pre-requisites completed:**

- Phase 1 (Build system) — done
- Phase 2 (Typed IPC, preload, security) — done
- Phase 3 (SQLite + Drizzle, repositories, IPC wiring) — done
- Phase A (Library swap & Tantivy service) — done

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
- [x] **A.3.2** Verify: `pnpm test` passes (55 tests total), `pnpm typecheck` 0 errors, `pnpm build` succeeds

---

## Phase B: Sermon Metadata & Language Pack Service

### B.1 — Schema Update

- [ ] **B.1.1** Add `sermonMetadata` table to `src/main/database/schema.ts`:
    - `id`, `translationId`, `languageCode`, `sermonDate`, `title`, `enTitle`, `audioLink`, `pdfLink`, `webLink`, `dateLong`, `paragraphCount`
    - Unique constraint on `(translationId, languageCode)`
    - Indexes on `languageCode`, `sermonDate`
- [ ] **B.1.2** Run `pnpm db:generate` to create new migration
- [ ] **B.1.3** Verify migration applies cleanly

### B.2 — Sermon Metadata Service

- [ ] **B.2.1** Create `src/main/services/sermon-metadata.service.ts`:
    - `buildMetadataFromIndex(langCode)` — scan Tantivy index for unique `(translation_id, sermon_date)` pairs, count paragraphs, insert into `sermon_metadata` table
    - For legacy French data: match `sermon_date` to `documents-title.db` records to populate `title`, `enTitle`, `audioLink`, `pdfLink`, `webLink`, `dateLong`
    - For other languages: use `translation_id` to cross-reference with existing metadata in other languages
- [ ] **B.2.2** Create `src/main/database/repositories/sermon-metadata.repository.ts`:
    - `getSermonList(langCode, options?)` — query by language, optional year/search filter, sorted by date
    - `getSermonMeta(translationId, langCode)` — get single sermon metadata
    - `getSermonsByYear(langCode)` — group by year
    - `getAvailableTranslations(translationId)` — list languages for a sermon
    - `upsertMetadata(data)` — insert or update metadata records
    - `deleteByLanguage(langCode)` — remove all metadata for a language (used when deleting language pack)
- [ ] **B.2.3** Unit tests for sermon metadata repository

### B.3 — Language Pack Service

- [ ] **B.3.1** Create `src/main/services/language-pack.service.ts`:
    - `fetchManifest()` — download `index.json` from GitHub release URL, parse, return typed manifest
    - `downloadLanguagePack(langCode, onProgress)` — download ZIP from release, unzip to `indexes/{langCode}/`, call `buildMetadataFromIndex(langCode)`
    - `deleteLanguagePack(langCode)` — remove index directory + metadata from SQLite
    - `getInstalledLanguages()` — combine filesystem scan with SQLite metadata counts
    - `getDownloadableLanguages()` — fetch manifest, diff against installed
- [ ] **B.3.2** Handle download robustness:
    - Verify checksum after download
    - Atomic extraction (unzip to temp dir, rename on success)
    - Resume/retry on network failure
- [ ] **B.3.3** Unit tests for language pack service (mock fetch, test manifest parsing)

### B.4 — Verification

- [ ] **B.4.1** `pnpm typecheck` — 0 errors
- [ ] **B.4.2** `pnpm test` — all tests pass
- [ ] **B.4.3** Manual: copy `tmp/` English index to `userData/indexes/en/`, run app, verify metadata builds

---

## Phase C: IPC Wiring

Wire the new services into IPC handlers so the renderer can access them.

### C.1 — New IPC Types

- [ ] **C.1.1** Add new types to `src/shared/types.ts`:
    - `SermonMeta` — id, translationId, languageCode, sermonDate, title, enTitle, audioLink, pdfLink, webLink, dateLong, paragraphCount
    - `SermonContent` — meta: SermonMeta, paragraphs: Paragraph[]
    - `Paragraph` — lineIndex, paragraphIndex, content (unstemmed_content)
    - `InstalledLanguage` — code, language, sermonsCount, sizeOnDisk
    - `DownloadableLanguage` — code, language, sermonsAvailable, sermonsWithAudio, filesize, installed
    - `TantivySearchResult` — hits: TantivySearchHit[], total: number, query: string
    - `TantivySearchHit` — translationId, sermonDate, title, snippet, score
    - `ParagraphReference` — paragraphIndex, translationId, languageCode, textSnippet?
- [ ] **C.1.2** Add new channel definitions to `src/shared/ipc.types.ts`:
    - `LanguageChannels` — getInstalled, getAvailable, install, delete
    - Add `documents:getSermonContent`, `documents:getSermonList`, `documents:getSermonsByYear`, `documents:getTranslations`
    - Add push channels: `push:languageDownloadProgress`, `push:languageInstalled`
- [ ] **C.1.3** Update `InvokeChannelMap` and `PushEventMap` with new types

### C.2 — IPC Handlers

- [ ] **C.2.1** Create `src/main/ipc/languages.ipc.ts`:
    - `languages:getInstalled` → `languagePackService.getInstalledLanguages()`
    - `languages:getAvailable` → `languagePackService.getDownloadableLanguages()`
    - `languages:install` → `languagePackService.downloadLanguagePack(langCode, progress => sendToRenderer(...))`
    - `languages:delete` → `languagePackService.deleteLanguagePack(langCode)`
- [ ] **C.2.2** Update `src/main/ipc/documents.ipc.ts`:
    - `documents:getTitles` → `sermonMetadataRepo.getSermonList(langCode)` (add langCode arg)
    - `documents:getSermonContent` → `tantivyService.getSermonParagraphs(langCode, translationId)` + metadata
    - `documents:getSermonList` → `sermonMetadataRepo.getSermonList(langCode, options)`
    - `documents:getSermonsByYear` → `sermonMetadataRepo.getSermonsByYear(langCode)`
    - `documents:getTranslations` → `sermonMetadataRepo.getAvailableTranslations(translationId)`
    - Remove `documents:getContentPath` stub
- [ ] **C.2.3** Update `src/main/ipc/search.ipc.ts`:
    - `search:searchText` → `tantivyService.searchSermons(langCode, query, limit, offset)`
    - `search:searchContent` → `tantivyService.getSearchSnippet(langCode, query, translationId)`
- [ ] **C.2.4** Update preload (`src/preload/index.ts`):
    - Add `languages` namespace with all language IPC calls
    - Update `documents` namespace with new sermon content methods
    - Add push event listeners for language download progress
- [ ] **C.2.5** Register `registerLanguageHandlers()` in `src/main/ipc/register.ts`

### C.3 — Config Updates

- [ ] **C.3.1** Add `activeLanguage` field to `configurations` table (or create `appSettings` single-row table)
- [ ] **C.3.2** Add `getActiveLanguage()` / `setActiveLanguage(langCode)` to config repository
- [ ] **C.3.3** Wire into `app:initialize` — return active language as part of init response

### C.4 — Verification

- [ ] **C.4.1** `pnpm typecheck` — 0 errors
- [ ] **C.4.2** `pnpm build` — builds successfully
- [ ] **C.4.3** Manual test: app boots, can call new IPC channels from devtools console

---

## Phase D: Renderer — Sermon View & Language UI

Replace the iframe-based document view with native React paragraph rendering.

### D.1 — Zustand Stores

- [ ] **D.1.1** Create `src/renderer/stores/language.store.ts`:
    - `installedLanguages`, `activeLanguage`, `setActiveLanguage()`, `refreshInstalled()`
    - On language change: reload sermon list
- [ ] **D.1.2** Update document store (or create `src/renderer/stores/sermon.store.ts`):
    - `sermons: SermonMeta[]` — replaces `Title[]`
    - `sermonsByYear: Record<string, SermonMeta[]>`
    - `activeSermonContent: SermonContent | null`
    - `loadSermons(langCode)`, `loadSermonContent(langCode, translationId)`
    - `searchResults: TantivySearchResult | null`
- [ ] **D.1.3** Update search store to use Tantivy results

### D.2 — Sidebar Documents

- [ ] **D.2.1** Add language selector dropdown to sidebar header (above tabs)
    - Shows installed languages with sermon counts
    - "Manage Languages" option at bottom
    - Persists selection to config
- [ ] **D.2.2** Update `DocumentSearch` component:
    - Load sermons from active language via new IPC channel
    - Filter by title (client-side for instant feedback)
    - Traduction filter changes to language filter (languages replace SHP/VGR/MS/BBV codes)
- [ ] **D.2.3** Update `DocumentByYears` component:
    - Load from `documents:getSermonsByYear` with active language
    - Year parsing adapts to `sermon_date` format
- [ ] **D.2.4** Update `DocumentByAlphabetic` component — same pattern, load from active language
- [ ] **D.2.5** Update `DocumentsAdded` (custom documents) — remains unchanged (custom docs are language-independent)

### D.3 — Sermon View Component

- [ ] **D.3.1** Create `src/renderer/views/sermon-view.tsx` — replaces `document-view.tsx`:
    - Receives `translationId` + `langCode` from active tab
    - Calls `documents:getSermonContent` IPC to get paragraphs
    - Renders sermon header: title, date, "Also in: [languages]"
    - Renders paragraphs as `<p>` elements with line numbers from `line_index`
    - Handles scroll position persistence (save to tab state)
    - Handles zoom (CSS transform, save to tab state)
- [ ] **D.3.2** Implement search highlight in sermon view:
    - When `documentViewQuery` is active, highlight matching text in paragraphs
    - Use Tantivy snippet data for precise highlight ranges
    - Scroll to first match
- [ ] **D.3.3** Implement subject/note reference highlighting:
    - When `selectedSubjectDocumentItem` is set, scroll to referenced `paragraphIndex`
    - Visual indicator on the referenced paragraph
- [ ] **D.3.4** Audio player integration:
    - Show audio player in sermon header if `audioLink` exists
    - Reuse existing `document-audio-player.tsx` modal with adapted props
    - Paragraph-level play indicator (if audio timestamp maps to paragraphs)

### D.4 — Tab System (framer-motion Reorder)

Replace legacy `ChromeTabs` + `draggabilly` with `framer-motion` `Reorder`.

- [ ] **D.4.1** Install `framer-motion` dependency
- [ ] **D.4.2** Update `DocumentTab` type in `src/shared/types.ts`:
    - Add `translationId: number` and `languageCode: string` fields
    - `title` becomes display title (from metadata)
    - `scrollY`/`scrollX`/`zoom` remain for sermon view state
- [ ] **D.4.3** Create `src/renderer/components/sermon-tabs.tsx`:
    - `Reorder.Group` with `axis="x"` for horizontal drag reorder
    - `Reorder.Item` per tab with `AnimatePresence` for enter/exit animations
    - Selected tab visual state via `animate` prop
    - Close button per tab with `onPointerDown` + `stopPropagation`
    - Max 6 tabs enforced (unchanged)
- [ ] **D.4.4** Content area animated transitions:
    - `AnimatePresence mode="wait"` wrapping `SermonView`
    - `motion.div` with `key={selectedTab.translationId}` for smooth tab switch
    - Fade + slide animation (opacity + y) on tab change
- [ ] **D.4.5** Update `useDocumentViewOpen` hook:
    - `onClick(translationId, langCode)` instead of `onClick(title)`
    - Creates tab with `translationId` + `langCode` + `title`
- [ ] **D.4.6** Remove legacy tab implementation:
    - Delete `src/renderer/plugins/chrome-tabs/chrome-tabs.ts` (414-line imperative class)
    - Delete `src/renderer/components/document-tabs.tsx` (legacy wrapper)
    - Remove `draggabilly` dependency from `package.json`
    - Remove Chrome tab SVG shapes and associated SCSS styles

### D.5 — Language Management Modal

- [ ] **D.5.1** Create `src/renderer/views/components/modals/language-manager-modal.tsx`:
    - List installed languages with size and "Delete" button
    - List downloadable languages with "Install" button
    - Download progress bar per language
    - Listen to `push:languageDownloadProgress` events
    - On install complete: refresh language store

### D.6 — Search View Updates

- [ ] **D.6.1** Update `src/renderer/views/options/search.tsx`:
    - Search uses active language
    - Results display sermon title + snippet (from Tantivy)
    - Click result opens sermon view at matching paragraph
    - Pagination via Tantivy offset
- [ ] **D.6.2** Update search suggestions — unchanged (SQLite-backed)

### D.7 — Other Traductions Modal

- [ ] **D.7.1** Update `other-traductions-modal.tsx`:
    - Instead of listing SHP/VGR/MS translations, show available languages
    - "View in English" / "View in Francais" etc.
    - Clicking opens the same sermon (by `translationId`) in the selected language

### D.8 — Cleanup Legacy Components

- [ ] **D.8.1** Remove `document-view.tsx` (replaced by `sermon-view.tsx`)
- [ ] **D.8.2** Remove `modules/documents/` directory (iframe scripts: html.js, peform-search.js, seach-query.js, document-tree.js, context-menu.js, functions.js, search-template.js)
- [ ] **D.8.3** Remove `modules/shared/shared.ts` constants: `CHILD_PARENT_WINDOW_EVENT`, `PARENT_WINDOW_EVENT`, `POST_MESSAGE_EVENT`, `DOCUMENT_CONTAINER_ID`, `DOCUMENT_CONTENT_ID`
- [ ] **D.8.4** Remove legacy `TRADUCTIONS` constant (`src/utils/constants.ts`) — replaced by language metadata
- [ ] **D.8.5** Remove `DocumentTitle` model class (`src/renderer/store/models/document_title.ts`) — replaced by `SermonMeta` type
- [ ] **D.8.6** Remove legacy Recoil atoms that are replaced: `titlesStore`, `documentTitlesStore`, `titlesDocumentSelector`, `titlesGroupedByYearSelector`, `documentViewQueryStore`
- [ ] **D.8.7** Remove legacy tab system:
    - Delete `src/renderer/plugins/chrome-tabs/chrome-tabs.ts` — imperative ChromeTabs class (414 lines)
    - Delete `src/renderer/components/document-tabs.tsx` — Recoil-based wrapper
    - Remove `draggabilly` dependency
    - Remove Chrome tab SCSS styles (SVG shapes, `.chrome-tab-*` classes)
- [ ] **D.8.8** Remove legacy document view hooks:
    - `usePostMessage` — iframe postMessage communication
    - `useDocumentQuery` — iframe search query relay
    - `useSubjectQuery` — iframe reload for subject highlighting
    - `useSearchQuery` — iframe postMessage search dispatch
    - `useDocumentsState` — iframe zoom/scroll via DOM events
    - `useOpenDocumentExternalLink` — iframe link interception
    - `useAlertFromIframe` — iframe alert events
    - `useToPostMessageCurrentAudioDocumentPlay` — iframe audio state relay

### D.9 — Verification

- [ ] **D.9.1** `pnpm typecheck` — 0 errors
- [ ] **D.9.2** `pnpm lint` — 0 errors
- [ ] **D.9.3** `pnpm build` — builds successfully
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

| Phase | Description                         | Key Deliverable                         |
| ----- | ----------------------------------- | --------------------------------------- |
| A     | Library swap & Tantivy service      | Read Tantivy indexes, search sermons    |
| B     | Sermon metadata & language packs    | Download language packs, build metadata |
| C     | IPC wiring                          | Renderer can access sermons and search  |
| D     | Renderer: sermon view & language UI | Native paragraph rendering, no iframe   |
| E     | First launch & setup screen         | User-driven language installation       |
| F     | Reference system migration          | Paragraph-based notes/subject refs      |
| G     | Index generation & release pipeline | Build & publish Tantivy indexes         |
| H     | Testing & polish                    | Full integration testing, performance   |
