# WMB Table - Refactoring Task List

Step-by-step execution plan for the full refactoring described in [REFACTORING.md](./REFACTORING.md).

Each phase produces a working (or at least buildable) application before proceeding to the next.

---

## Phase 1: Project Foundation & Build System

Bootstrap the new project skeleton with electron-vite, replacing Webpack + Babel entirely.

### 1.A — Dependency Audit (`src/package.json`)

Audit and plan the replacement for all 16 production dependencies in `src/package.json` (see REFACTORING.md §7 for full details):

- [x] **1.A.1** Verify `@seald-io/nedb` and `nedb` usage → replaced by `better-sqlite3` + `drizzle-orm` — `@seald-io/nedb` (6 files), `nedb` (0 files — unused, safe to remove)
- [x] **1.A.2** Verify `express` usage (backup auth server) → remove, use Electron protocol handler — `express` (1 file — OAuth child process)
- [x] **1.A.3** Verify `firebase-admin` + `fireorm` + `reflect-metadata` usage → remove (evaluate if Firebase is still needed) — `firebase-admin` (2 files), `fireorm` (2 files), `reflect-metadata` (1 file) — synchronizer feature
- [x] **1.A.4** Verify `googleapis@39` usage → update to `googleapis@^144.0.0` — `googleapis` (4 files — backup/Drive)
- [x] **1.A.5** Verify `request` usage → remove, replace all call sites with native `fetch` — `request` (3 files — HTTP downloads)
- [x] **1.A.6** Verify `async`, `lazy`, `underscore` usage → remove, replace with native JS — `async` (6 files via re-export), `lazy` (1 file), `underscore` (0 files — unused)
- [x] **1.A.7** Verify `html-pdf` usage → evaluate replacement (`webContents.printToPDF()` or `puppeteer`) — `html-pdf` (1 file — child process PDF gen)
- [x] **1.A.8** Verify `fs-extra` usage → replace with `node:fs/promises` — `fs-extra` (3 files — copy progress, data-prepared, clean.js)
- [x] **1.A.9** Verify `get-folder-size`, `is-online` usage → inline or remove — `get-folder-size` (1 file), `is-online` (6 files — pervasive, inline replacement in Phase 6)
- [x] **1.A.10** Verify `node-watch` usage → replace with `chokidar@^4.0.3` — `node-watch` (1 file — backup watcher)
- [x] **1.A.11** Verify `node-html-parser`, `uuid` usage → update to latest versions — `node-html-parser` (1 file — search indexing), `uuid` (1 file — app ID)

### 1.B — Delete Old Build Infrastructure

Remove files and directories that are replaced by the new build system:

- [x] **1.B.1** Delete `.erb/` directory (Webpack configs, scripts, mocks, images)
- [x] **1.B.2** Delete `babel.config.js`
- [x] **1.B.3** Delete `.eslintrc.js` and `.eslintignore`
- [x] **1.B.4** Delete `clean/` directory (`clean.js`)
- [x] **1.B.5** Delete `hooks/` directory (`restore-dev-datas.js`)
- [x] **1.B.6** Delete `modules-output/` directory (if present)
- [x] **1.B.7** Delete `yarn.lock` (root)
- [x] **1.B.8** Delete `src/yarn.lock`
- [x] **1.B.9** Delete `src/package.json` (deps moved to root)
- [x] **1.B.10** Delete `src/dev-app-update.yml`
- [x] **1.B.11** Delete `tmp/` directory

### 1.C — Initialize Package Manager & Dependencies

- [x] **1.C.1** Initialize pnpm — run `pnpm init`, verify `.npmrc` settings if needed
- [x] **1.C.2** Write new `package.json` with complete content (see REFACTORING.md §8)
- [x] **1.C.3** Run `pnpm install` — verify all dependencies resolve
- [x] **1.C.4** Verify `better-sqlite3` native addon builds successfully for current platform

### 1.D — Create Configuration Files

Each config file has its exact content specified in REFACTORING.md §9:

- [x] **1.D.1** Create `electron.vite.config.ts` — electron-vite v5 config (no `externalizeDepsPlugin`, enabled by default) with path aliases (§9.1)
- [x] **1.D.2** Create `tsconfig.json` — root project references file (§9.2)
- [x] **1.D.3** Create `tsconfig.main.json` — main process, ES2022 target, Node libs (§9.3)
- [x] **1.D.4** Create `tsconfig.preload.json` — preload script, ES2022 target (§9.4)
- [x] **1.D.5** Create `tsconfig.renderer.json` — renderer, ES2022 target, DOM + JSX (§9.5)
- [x] **1.D.6** Create `eslint.config.js` — ESLint 9 flat config with TS + React plugins (§9.6)
- [x] **1.D.7** Create `.prettierrc` — singleQuote, trailing commas, 100 width (§9.7)
- [x] **1.D.8** Create `vitest.config.ts` — Node environment, path aliases, coverage config (§9.8)
- [x] **1.D.9** Create `drizzle.config.ts` — SQLite dialect, schema path, output dir (§9.9)

### 1.E — Create New Folder Structure (Placeholders)

Create the directory tree and placeholder files for the new architecture:

- [x] **1.E.1** Create `src/main/index.ts` — minimal main entry with BrowserWindow + security settings
- [x] **1.E.2** Create `src/main/ipc/` directory with empty `register.ts`
- [x] **1.E.3** Create `src/main/database/` directory with empty `index.ts` and `schema.ts`
- [x] **1.E.4** Create `src/main/database/repositories/` directory
- [x] **1.E.5** Create `src/main/database/migrations/` directory with `.gitkeep`
- [x] **1.E.6** Create `src/main/services/` directory
- [x] **1.E.7** Create `src/main/lib/` directory
- [x] **1.E.8** Create `src/preload/index.ts` — minimal preload with contextBridge
- [x] **1.E.9** Create `src/renderer/main.tsx` — minimal React 19 entry with `createRoot`
- [x] **1.E.10** Create `src/renderer/App.tsx` — minimal root component
- [x] **1.E.11** Create `src/renderer/stores/` directory
- [x] **1.E.12** Create `src/renderer/views/` directory
- [x] **1.E.13** Create `src/renderer/components/` directory
- [x] **1.E.14** Create `src/renderer/hooks/` directory
- [x] **1.E.15** Create `src/renderer/styles/` directory
- [x] **1.E.16** Create `src/shared/ipc.types.ts` — empty channel type definitions
- [x] **1.E.17** Create `src/shared/constants.ts` — empty constants file
- [x] **1.E.18** Create `src/shared/types.ts` — empty domain types file
- [x] **1.E.19** Create `src/renderer/index.html` — HTML template for electron-vite renderer
- [x] **1.E.20a** Create `resources/` directory
- [x] **1.E.20b** Move `assets/entitlements.mac.plist` → `resources/entitlements.mac.plist`
- [x] **1.E.20c** Move `assets/icon.*` (icns, ico, png) → `resources/`
- [x] **1.E.20d** Move `assets/icons/` → `resources/icons/`
- [x] **1.E.20e** Move `assets/pdf2html-ex/` → `resources/pdf2html-ex/`
- [x] **1.E.20f** Move `assets/img/` → `src/renderer/assets/`
- [x] **1.E.20g** Move `assets/assets.d.ts` → `src/renderer/assets.d.ts`
- [ ] **1.E.20h** Delete remaining `assets/` directory — deferred to Phase 4 (`assets/datas/` still has runtime data placeholders)
- [x] **1.E.21** Create `drizzle/` directory with `.gitkeep`
- [x] **1.E.22** Create `tests/unit/main/` and `tests/unit/shared/` directories
- [x] **1.E.23** Create `tests/components/` and `tests/integration/` directories

### 1.F — Update Repo Configuration

- [x] **1.F.1** Rewrite `.gitignore` from scratch for new structure
- [x] **1.F.2** `.editorconfig` kept as-is (already correct: 2 spaces, lf, utf-8)
- [x] **1.F.3** Renamed `.env.exemple` to `.env.example`

### 1.G — Verification

- [x] **1.G.1** Run `pnpm install` — all dependencies resolve without errors
- [x] **1.G.2** Run `pnpm typecheck` — TypeScript compilation passes
- [x] **1.G.3** Run `pnpm lint` — ESLint passes (0 errors, 3 warnings from legacy `assets.d.ts`)
- [x] **1.G.4** Run `pnpm test` — Vitest runs (0 tests, no config errors)
- [x] **1.G.5** Run `pnpm dev` — electron-vite builds main/preload/renderer and starts Electron
- [x] **1.G.6** Run `pnpm build` — electron-vite produces output in `out/` directory (main, preload, renderer)
- [x] **1.G.7** Verify no old config files remain (`.erb/`, `babel.config.js`, `.eslintrc.js`, etc.)

> **Note — Legacy file excludes:** Phase 1 added `exclude` patterns in `tsconfig.main.json`, `tsconfig.renderer.json`, and `ignores` in `eslint.config.js` to skip legacy source files from type-checking and linting. As each module is migrated in its respective phase, **remove its exclude/ignore entry** so it becomes type-checked and linted. By the end of Phase 8 (cleanup), all exclude entries should be gone.

---

## Phase 2: Electron Main Process & Security

Set up the secure Electron main process with contextIsolation and preload script.

- [x] **2.1** Create `src/main/index.ts` — new main entry point:
    - `BrowserWindow` with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
    - Load preload script via `webPreferences.preload`
    - Window size/min-size matching current (1024x800, min 933x572)
    - Set Content Security Policy headers via `session.defaultSession.webRequest`
    - `show: false` + `ready-to-show` → maximize + show (matches legacy)
    - `setWindowOpenHandler` for external links
    - Build menu + set application menu
    - TouchBar on macOS (dynamic import)
    - `initializeUpdater` when packaged
    - `setMainWindow()` after creation
- [x] **2.2** Create `src/preload/index.ts` — full contextBridge with all domain namespaces:
    - `contextBridge.exposeInMainWorld('api', { ... })` with domain namespaces: documents, search, notes, bible, subjects, audio, backup, app, on (push events)
    - Type declaration file `src/preload/index.d.ts` for `window.api`
    - Added `src/preload/index.d.ts` to `tsconfig.renderer.json` include
    - Push event listeners return unsubscribe functions
- [x] **2.3** Create `src/shared/ipc.types.ts` + `src/shared/types.ts` — typed IPC channel definitions and domain types:
    - Ported all domain types from legacy `src/types/index.d.ts` (removed NeDB `TimeStampData`, `_id` → `id`, inlined updater types, removed global augmentations)
    - Channel constants grouped by domain using `domain:method` naming (e.g., `documents:getTitles`)
    - `InvokeChannelMap` — maps each channel to `{ args: [...]; return: Type }` (56 invoke channels)
    - `PushEventMap` — maps each push channel to its payload type (16 push channels)
    - Split dual-purpose legacy channels (e.g., `document_tabs` → `documents:getTabs` + `documents:saveTabs`)
- [x] **2.4** Create IPC registration utility (`src/main/ipc/register.ts`):
    - `registerHandler<C>(channel, handler)` — type-safe wrapper around `ipcMain.handle` with error serialization
    - `sendToRenderer<C>(window, channel, payload)` — typed wrapper around `webContents.send`
    - `initializeIpc()` — calls all 8 domain `register*Handlers()` functions
- [x] **2.5** Create domain handler stubs (8 files, all throw "Not implemented"):
    - `src/main/ipc/documents.ipc.ts` — 4 stub handlers
    - `src/main/ipc/search.ipc.ts` — 4 stub handlers
    - `src/main/ipc/notes.ipc.ts` — 17 stub handlers
    - `src/main/ipc/bible.ipc.ts` — 3 stub handlers
    - `src/main/ipc/subjects.ipc.ts` — 6 stub handlers
    - `src/main/ipc/audio.ipc.ts` — 4 stub handlers
    - `src/main/ipc/backup.ipc.ts` — 4 stub handlers
    - `src/main/ipc/app.ipc.ts` — 14 stub handlers
- [x] **2.6** Preload exposes all IPC channels via `contextBridge`:
    - Each domain namespace maps to `ipcRenderer.invoke(channel, ...args)`
    - Event listeners for push events return unsubscribe functions
- [x] **2.7** Created `src/main/lib/window.ts` — `setMainWindow(w)` / `getMainWindow()` getter/setter
- [x] **2.8** Migrated platform-specific code:
    - `src/main/lib/menu.ts` — ported MenuBuilder from legacy with French labels, uses `sendToRenderer` + `PushChannels`
    - `src/main/lib/touch-bar.ts` — ported TouchBar for macOS, uses `sendToRenderer` + `PushChannels`
- [x] **2.9** Set up `electron-log` v5 in `src/main/lib/logger.ts` — file + console transports, 5MB max file size
- [x] **2.10** Set up `electron-updater` v6 scaffold in `src/main/lib/updater.ts` — simplified (see note below)
- [x] **2.11** Verified: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors), `pnpm build` (produces `out/`)

> **Note — Simplified Updater:** The legacy updater had a complex backup/restore cycle because data was bundled inside the installation directory (`assets/datas/`). On update, it had to: (1) back up user data, (2) download & install the new app version, (3) restore backed-up data. Since data is now stored in `app.getPath('userData')` (Phase 4) and documents/Bible data will be downloaded by the user on first launch (not bundled with the app), the entire backup/restore cycle is **eliminated**. The updater now just: check → notify → download → install. The `UpdaterNotification` type has been simplified accordingly — the `preparing`, `prepared`, `restoring`, `restored`, `restartedToUpdate` states are no longer needed. See Phase 4 for the new data acquisition flow.

---

## Phase 3: Database Migration (NeDB → SQLite + Drizzle)

Replace all 18 NeDB collections with a proper SQLite database using Drizzle ORM.

- [x] **3.1** Install and configure `better-sqlite3` + `drizzle-orm` + `drizzle-kit`
- [x] **3.2** Create `drizzle.config.ts` for migration generation
- [x] **3.3** Create Drizzle schema (`src/main/database/schema.ts`) mapping all 18 NeDB collections:
    - `documentsTitle` — id, title, year, date, path, language, and metadata fields
    - `bibleVerses` — id, book, chapter, verse, content (with FTS5 virtual table for search)
    - `configurations` — key-value store for app settings
    - `tabs` — document tab state (order, active, document reference)
    - `suggestions` — search suggestion cache
    - `sidebarStatus` — UI sidebar visibility state
    - `notes` — id, title, content, timestamps
    - `notesReferences` — noteId FK, documentId, metadata
    - `notesBibleReferences` — noteId FK, book, chapter, verse
    - `subjects` — id, name, timestamps
    - `subjectItems` — subjectId FK, documentId, metadata
    - `history` — id, timestamps, metadata
    - `historyItems` — historyId FK, documentId, action, timestamps
    - `customDocuments` — id, filename, path, metadata
    - `audioTimes` — documentId, timestamps mapping
    - `audioDownloads` — documentId, localPath, metadata
    - `audioLastPlay` — documentId, position, timestamps
    - `backupReferences` — sync metadata
    - `backupStatus` — sync state tracking

> **Implementation note — 3.3 Schema divergence:** The final architecture uses a **three-database design** instead of one. Sermon/document metadata lives in a read-only bundled `data.sqlite` (68K+ rows, 14 tables) — not in the user DB. Bible verses live in per-language Bible SQLite files (e.g., `bible.fr-lsg.sqlite`) with their own schema in `src/main/database/bible-schema.ts` — not in the user DB. The user DB (`wmb-table.sqlite`) has **17 Drizzle tables** for personalized data only. A `sermon_metadata` table was initially added but later dropped (migration `0005`). The `documentsTitle` and `bibleVerses` tables listed above are handled by the reference DB and Bible DBs respectively.

- [x] **3.4** Generate initial SQL migration with `drizzle-kit generate`
- [x] **3.5** Create database connection module (`src/main/database/index.ts`):
    - Initialize better-sqlite3 with WAL mode
    - Database path: `app.getPath('userData')/databases/wmb-table.sqlite`
    - Separate Bible database: `app.getPath('userData')/databases/bible.sqlite`
    - Run Drizzle migrations on startup

> **Implementation note — 3.5 Bible DB divergence:** Bible DBs are **read-only bundled files** in `resources/database/` with language-specific naming (e.g., `bible.fr-lsg.sqlite`), managed by `src/main/services/bible.service.ts`. Remote Bible versions download to `userData/databases/bibles/`. The reference database (`data.sqlite`) is opened read-only with mmap via `src/main/database/reference-db.ts`.

- [x] **3.6** Create repository layer (`src/main/database/repositories/`):
    - `documents.repository.ts` — findAll, findById, search, getContent
    - `notes.repository.ts` — CRUD notes, addReference, removeReference, addBibleRef
    - `bible.repository.ts` — getBooks, getChapter, searchVerses (FTS5)
    - `subjects.repository.ts` — CRUD subjects and items
    - `audio.repository.ts` — getTimes, setTimes, getDownloads, setLastPlay
    - `history.repository.ts` — addEntry, getHistory, clearHistory
    - `backup.repository.ts` — getStatus, setStatus, getReferences, setPending
    - `config.repository.ts` — get, set, getAll
    - `tabs.repository.ts` — getOpenTabs, saveTabs
    - `suggestions.repository.ts` — getSuggestions, addSuggestion
    - `sidebar.repository.ts` — getStatus, setStatus
    - `custom-documents.repository.ts` — CRUD custom documents

> **Implementation note — 3.6 Repository divergence:** `custom-documents.repository.ts` was merged into `documents.repository.ts`. An additional `reference.repository.ts` was added (Phase D) for raw `better-sqlite3` queries against the read-only `data.sqlite`. Total: 12 repository files in `src/main/database/repositories/`.

- [x] **3.7** Write NeDB → SQLite migration script (`src/main/database/migrate-from-nedb.ts`):
    - Read each `.db` file line by line (NeDB stores one JSON doc per line)
    - Parse and insert into corresponding SQLite tables
    - Preserve `_id` as primary key, `createdAt`/`updatedAt` timestamps
    - Handle data type conversions (NeDB dates → SQLite integers/ISO strings)
    - Make migration idempotent (skip if already migrated)
- [x] **3.8** Add first-launch detection:
    - Check for existing SQLite database
    - If missing, check for legacy NeDB files at old install-dir location
    - If legacy found, run migration; if not, seed from bundled resources
- [x] **3.9** Wire repositories into IPC handlers (replace `queryDb` calls with repository methods)
- [x] **3.10** Write unit tests for all repositories (Vitest, using in-memory SQLite)
- [x] **3.11** Verify: all data operations work via new database layer, no NeDB references remain

---

## Phase 4: Data Storage & User-Driven Data Acquisition

Move all user data from installation directory to OS-standard user data paths. Replace the legacy model of bundling data inside the app with a user-driven download flow on first launch.

> **Architecture change:** Previously, documents and Bible data were bundled inside the installation directory (`assets/datas/`), which caused data loss on updates and required the complex updater backup/restore cycle. In the new architecture:
>
> - **No data is bundled with the app** — the app ships as a lightweight shell
> - **On first launch**, the app detects missing data and presents a setup/download UI
> - **Data is downloaded** from a remote source (API/CDN) into `app.getPath('userData')`
> - **Updates are safe** — `electron-updater` replaces the app binary only; user data in `userData` is untouched
> - This also reduces the app installer size significantly

- [ ] **4.1** Define path constants in `src/main/lib/paths.ts`:
    - `USER_DATA_PATH` = `app.getPath('userData')`
    - `DATABASES_PATH` = `<userData>/databases/`
    - `DOCUMENTS_PATH` = `<userData>/documents/`
    - `BACKUPS_PATH` = `<userData>/backups/`
    - `AUDIO_PATH` = `<userData>/audio/`
    - `RESOURCES_PATH` = `process.resourcesPath` (read-only bundled assets — icons, entitlements only)
- [ ] **4.2** Implement first-launch data acquisition flow:
    - **4.2.1** Create `src/main/services/data-setup.service.ts` — orchestrates initial data download
    - **4.2.2** On `app:initialize`, detect if `DATABASES_PATH` and `DOCUMENTS_PATH` exist; if not, signal renderer to show setup UI
    - **4.2.3** Add IPC channels: `app:getSetupStatus`, `app:startDataDownload`, push channel `push:dataDownloadProgress`
    - **4.2.4** Download document titles database, Bible database, and document content from remote source
    - **4.2.5** Report download progress to renderer via push events (percentage, current file, ETA)
    - **4.2.6** Mark setup as complete in config database once all data is downloaded
- [ ] **4.3** Create first-launch setup UI in renderer:
    - **4.3.1** Create `src/renderer/views/setup/SetupView.tsx` — shown on first launch instead of main app
    - **4.3.2** Progress bar with download status (file count, bytes downloaded, ETA)
    - **4.3.3** Error handling with retry capability (network failures, partial downloads)
    - **4.3.4** Transition to main app view once setup completes
- [ ] **4.4** Update custom document upload to save files to `DOCUMENTS_PATH` instead of `assets/datas/documents/`
- [ ] **4.5** Update backup system paths to use `BACKUPS_PATH`
- [ ] **4.6** Update audio download paths to use `AUDIO_PATH`
- [ ] **4.7** Consolidate `~/.wmb-table/` data into `app.getPath('userData')` (migrate `audios-downloads.db`)
- [ ] **4.8** Remove credentials from `assets/datas/credentials/` — move to secure storage or environment-based config
- [ ] **4.9** Update `electron-builder` `extraResources` config — only bundle `resources/` (icons, entitlements, no data)
- [ ] **4.10** Verify: app uses correct paths on all platforms; data persists across app restarts and app updates

---

## Phase 5: Renderer Modernization (React 19 + Zustand + Ant Design 6)

Migrate the entire frontend from React 17/Recoil/Antd 4 to React 19/Zustand/Antd 6.

- [ ] **5.1** Create renderer entry point `src/renderer/main.tsx` with `createRoot` (React 19 API)
- [ ] **5.2** Create root `App.tsx` with Ant Design 6 `ConfigProvider` (locale, theme)
- [ ] **5.3** Create Zustand stores (replacing Recoil atoms/selectors):
    - `src/renderer/stores/app.store.ts` — appView, optionView, loading, sidebarStatus
    - `src/renderer/stores/document.store.ts` — titles, tabs, currentTab, titlesGroupedByYear
    - `src/renderer/stores/search.store.ts` — query, results, suggestions
    - `src/renderer/stores/notes.store.ts` — notes list, activeNote, references
    - `src/renderer/stores/bible.store.ts` — books, currentBook/chapter, searchResults
    - `src/renderer/stores/subjects.store.ts` — subjects list, items
    - `src/renderer/stores/audio.store.ts` — currentAudio, playbackState, downloads
- [ ] **5.4** Create typed IPC hooks (`src/renderer/hooks/useIpc.ts`):
    - `useIpcQuery(channel, args)` — fetch data via `window.api`, return loading/error/data
    - `useIpcMutation(channel)` — mutate via `window.api`, return execute/loading/error
    - Replace all `useIpcRequestWithLoader` usages
- [ ] **5.5** Migrate layout components:
    - `src/renderer/components/Layout.tsx` — main Ant Design layout (Header, Sider, Content)
    - `src/renderer/components/SidebarMenu.tsx` — navigation menu
    - `src/renderer/components/ViewerMenu.tsx` — top menu bar
    - `src/renderer/components/SidebarDocuments.tsx` — right sidebar document list
- [ ] **5.6** Migrate view components:
    - `src/renderer/views/document/` — document viewer, tab management
    - `src/renderer/views/search/` — full-text search interface
    - `src/renderer/views/notes/` — notes editor (evaluate CKEditor 5 vs lighter alternative)
    - `src/renderer/views/bible/` — Bible reader and search
    - `src/renderer/views/subjects/` — topic/subject management
    - `src/renderer/views/history/` — browsing history
- [ ] **5.7** Migrate Ant Design v4 → v6 API changes:
    - Update import paths (some components moved)
    - Replace deprecated component props
    - Update theme customization to use `ConfigProvider` token system
    - Fix any breaking changes in Form, Table, Modal, Menu, etc.
- [ ] **5.8** Migrate custom hooks from `src/renderer/hooks.ts`:
    - `useContainerScrollY` → keep/modernize
    - `useOptionsMenu` → adapt to Zustand
    - `useModalVisible` → keep/modernize
    - `useDocumentTitle` → adapt to Zustand store
    - Remove hooks that duplicate Zustand functionality
- [ ] **5.9** Migrate SCSS styles:
    - Update deprecated Sass syntax (`/` division → `math.div()`, `@import` → `@use`)
    - Remove Webpack-specific CSS module patterns
    - Ensure Vite handles SCSS imports correctly
- [ ] **5.10** Handle `draggabilly` tab dragging — evaluate if needed or replace with HTML5 Drag & Drop / `@dnd-kit`
- [ ] **5.11** Inline or replace `modules/` custom modules:
    - `modules/context-menu/` — inline into renderer or use Electron's built-in context menu
    - `modules/documents/` — inline into main process services
    - `modules/shared/` — inline into `src/shared/`
- [ ] **5.12** Remove `RecoilRoot` and all Recoil imports
- [ ] **5.13** Verify: all views render correctly, navigation works, data loads from SQLite via IPC
- [x] **5.14** Redesign sidebar document list (`ItemOutline` in `sidebar-documents.tsx`) — rich two-column layout with title, English subtitle, formatted date, traduction badges, city/state, and audio icon; add `cityState` field to `SermonMeta`/`RefSermon`, JOIN city/state in reference repository, add `formatSermonDate()` utility, add `.sidebar-item` CSS

---

## Phase 6: Services & Features Migration

Migrate business logic services (backup, updater, document processing).

- [ ] **6.1** Migrate backup service (`src/main/services/backup.service.ts`):
    - Google Drive API integration (modernize from `request` to `fetch`)
    - File watcher for pending changes (replace `node-watch` if needed)
    - Progress reporting via typed IPC events
    - Credential handling (move from bundled files to secure storage)
- [ ] **6.2** Wire auto-updater service (`src/main/lib/updater.ts`):
    - Scaffold already created in Phase 2 — wire real IPC handler implementations in `app.ipc.ts`
    - Simplified flow: check → notify → download → install (no backup/restore cycle)
    - The legacy `data-prepared.ts`, `datastore.ts`, `constants.ts` (updater state management) are **not migrated** — they are no longer needed since data lives in `app.getPath('userData')` and is unaffected by app updates
    - Update `publish` config in `electron-builder` for GitHub releases
    - `UpdaterNotification.type` only uses: `none`, `hasUpdate`, `downloading`, `downloaded`, `error` (removed: `preparing`, `prepared`, `restoring`, `restored`, `restartedToUpdate`)
- [ ] **6.3** Migrate document processing service (`src/main/services/document.service.ts`):
    - PDF-to-HTML conversion (evaluate current `pdf2html-ex` approach)
    - Custom document upload flow
    - File path resolution using new `DOCUMENTS_PATH`
- [ ] **6.4** Migrate child processes (`src/main/childs_processes/`):
    - Review document conversion workers
    - Update paths and module resolution for electron-vite
    - Consider using `utilityProcess` (Electron API) instead of `child_process`
- [ ] **6.5** Replace deprecated `request` / `request-progress` with native `fetch` or `undici`
- [ ] **6.6** Verify: backup creates/restores successfully, auto-updater checks/downloads/installs correctly, document upload works

---

## Phase 7: Testing

Establish test coverage for critical paths.

- [ ] **7.1** Configure Vitest for main process tests (Node environment)
- [ ] **7.2** Configure Vitest for renderer tests (jsdom environment, React Testing Library)
- [ ] **7.3** Write repository unit tests:
    - Documents repository (find, search, content retrieval)
    - Notes repository (CRUD, references)
    - Bible repository (search with FTS5)
    - Config repository (get/set)
- [ ] **7.4** Write service unit tests:
    - Backup service (mock Google Drive API)
    - Document service (file operations)
- [ ] **7.5** Write IPC handler integration tests:
    - Mock database, verify handler responses
- [ ] **7.6** Write React component tests:
    - Layout renders correctly
    - Document list loads and displays titles
    - Search returns results
    - Notes CRUD operations
- [ ] **7.7** Write Zustand store tests:
    - Store initialization
    - Action dispatching
    - Derived state computation
- [ ] **7.8** Verify: `pnpm test` passes, coverage report generates

---

## Phase 8: Cleanup & Polish

Remove all legacy code, fix remaining issues, finalize the refactoring.

- [ ] **8.1** Remove all old source files:
    - `src/main.dev.ts` (old entry point)
    - `src/main.prod.js*` (old build output)
    - `src/index.tsx` (old renderer entry)
    - `src/ipc/` (old IPC layer — `ipc-main.ts`, `ipc-renderer.ts`)
    - `src/renderer/store/` (Recoil store)
    - `src/main/db/` (NeDB database layer)
    - `src/main/message-control/` (old IPC handlers)
    - `src/main/platforms/` (if migrated to new location)
    - `src/utils/ipc-events.ts` (old untyped event constants)
- [ ] **8.2** Remove old config files:
    - `.erb/` directory entirely
    - `babel.config.js`
    - Old ESLint config files
    - `hooks/restore-dev-datas.js`
    - `clean/clean.js`
- [ ] **8.3** Remove deprecated dependencies from `package.json`:
    - All 17 `@babel/*` packages
    - All Webpack packages and loaders
    - `node-sass`, `recoil`, `enzyme*`, `jest*`
    - `request`, `request-progress`, `regenerator-runtime`, `source-map-support`
    - `electron-debug`, `electron-rebuild`, `opencollective-postinstall`, `yarn-deduplicate`
    - `core-js`, `chalk`, `detect-port`, `rimraf`, `identity-obj-proxy`
    - `history`, `@types/history`
    - See full list in REFACTORING.md "Packages to Remove" section
- [ ] **8.4** Remove `assets/datas/` directory (data now lives in `app.getPath('userData')`)
- [ ] **8.5** Remove `modules/` directory and `modules-output/` (inlined into src)
- [ ] **8.6** Update `package.json` scripts — remove old `build:main`, `build:renderer`, `build:modules`, `postinstall`, `rebuild`, `assets-datas`, `clean`
- [ ] **8.7** Update `package.json` metadata — remove `devEngines`, `renovate`, `husky` (if unused), `browserslist`, old `jest` config, `lint-staged` (reconfigure for new tooling)
- [ ] **8.8** Configure `lint-staged` + `husky` (or `simple-git-hooks`) for pre-commit: `eslint --fix` + `prettier --write`
- [ ] **8.9** Run full lint pass: `pnpm lint --fix` — fix all ESLint/Prettier issues
- [ ] **8.10** Run TypeScript strict check: `pnpm typecheck` — fix all type errors
- [ ] **8.11** Run full test suite: `pnpm test` — all tests pass
- [ ] **8.12** Test packaging on all platforms:
    - `pnpm package` produces working macOS DMG
    - `pnpm package` produces working Windows NSIS installer
    - `pnpm package` produces working Linux AppImage
- [ ] **8.13** Test data migration path: install old version → upgrade to new version → verify all data migrated correctly
- [ ] **8.14** Verify no references to old architecture remain (`grep` for `require(`, `ipcRenderer.send`, `ipcMain.on`, `nedb`, `recoil`, `webpack`, `babel`)

---

## Summary

| Phase | Description                       | Key Deliverable                    |
| ----- | --------------------------------- | ---------------------------------- |
| 1     | Project Foundation & Build System | New electron-vite project boots    |
| 2     | Electron Main Process & Security  | Secure window with typed IPC       |
| 3     | Database Migration                | SQLite + Drizzle replaces NeDB     |
| 4     | Data Storage Relocation           | User data in OS-standard paths     |
| 5     | Renderer Modernization            | React 19 + Zustand + Antd 6 UI     |
| 6     | Services & Features Migration     | Backup, updater, docs working      |
| 7     | Testing                           | Vitest test suite with coverage    |
| 8     | Cleanup & Polish                  | No legacy code, all platforms pass |
