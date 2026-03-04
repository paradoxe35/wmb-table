# WMB Table - Full Refactoring Specification

## 1. Overview

WMB Table is an Electron desktop application for managing and studying William Marrion Branham's sermons and documents. It provides document browsing, full-text search, Bible reference lookup, note-taking, audio playback, topic organization, and Google Drive backup synchronization.

The application is 4+ years outdated, running on deprecated/EOL technologies with critical security vulnerabilities. This specification describes a comprehensive modernization of the entire stack while preserving all existing functionality.

## 2. Current State Assessment

### 2.1 Technology Stack (Current)

| Layer            | Current              | Status                               |
| ---------------- | -------------------- | ------------------------------------ |
| Runtime          | Electron 16.0.8      | EOL, multiple CVEs                   |
| UI Framework     | React 17.0.1         | Outdated (2 major versions behind)   |
| Language         | TypeScript 4.0.5     | Outdated                             |
| Build System     | Webpack 5 + Babel 7  | Heavy, slow DX                       |
| Package Manager  | Yarn (classic)       | Functional but not optimal           |
| Database         | @seald-io/nedb 2.0.4 | File-based, no SQL, limited querying |
| State Management | Recoil 0.3.1         | Unmaintained / archived              |
| UI Components    | Ant Design 4.16.13   | Outdated (2 major versions behind)   |
| CSS Preprocessor | node-sass            | Deprecated (superseded by dart-sass) |
| Testing          | Jest 26 + Enzyme     | Enzyme unmaintained                  |
| Linting          | ESLint 7             | Legacy config format                 |

### 2.2 Critical Issues

#### Security Vulnerabilities

- **`nodeIntegration: true`** — Renderer process has full Node.js access. Any XSS in the renderer can execute arbitrary system commands.
- **`contextIsolation: false`** — No boundary between web page and Electron internals. Prototype pollution can escalate to RCE.
- **No preload script** — All Node APIs exposed directly in the browser context.
- **Credentials stored in assets/** — OAuth2 credentials bundled with the app source.

#### Data Storage

- All user data (databases, documents, backups) stored **inside the installation directory** (`assets/datas/`). This means:
  - Data is lost on app update/reinstall
  - No standard OS data location
  - Write permissions issues on some platforms
  - Only `audios-downloads.db` is correctly stored in `~/.wmb-table/`

#### Architecture

- 77 untyped IPC events using `ipcMain.on/send` pattern (fire-and-forget with reply callbacks)
- No type safety across IPC boundary
- Manual promise wrapping in `mainMessageTransport`
- Child processes for document conversion with hardcoded paths
- No test coverage (test infrastructure exists but no test files)

### 2.3 Current Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                 Main Process                     │
│                                                  │
│  main.dev.ts                                     │
│    ├── BrowserWindow (nodeIntegration: true)     │
│    ├── message-control/ (77 IPC handlers)        │
│    ├── db/ (18 NeDB collections)                 │
│    ├── features/                                 │
│    │   ├── backup/ (Google Drive sync)           │
│    │   └── app-updater/                          │
│    ├── dialogs/                                  │
│    └── childs_processes/ (PDF conversion)        │
│                                                  │
│  ipcMain.on(event) ←→ event.reply(event-reply)  │
└────────────────────┬────────────────────────────┘
                     │ No isolation
┌────────────────────┴────────────────────────────┐
│               Renderer Process                   │
│                                                  │
│  index.tsx                                       │
│    ├── RecoilRoot (state management)             │
│    ├── ConfigProvider (Ant Design, fr_FR)         │
│    ├── views/                                    │
│    │   ├── document/ (viewer, tabs)              │
│    │   ├── search/                               │
│    │   ├── notes/                                │
│    │   ├── bible/                                │
│    │   ├── subjects/ (topics)                    │
│    │   └── history/                              │
│    ├── components/ (layout, sidebar, menus)      │
│    └── store/ (Recoil atoms + selectors)         │
│                                                  │
│  ipcRenderer.send(event) / .on(event-reply)      │
└──────────────────────────────────────────────────┘
```

## 3. Target Architecture

### 3.1 Technology Stack (Target)

| Layer            | Target                                     | Rationale                                                |
| ---------------- | ------------------------------------------ | -------------------------------------------------------- |
| Runtime          | Electron 40.7.0 (latest stable)            | Security patches, modern APIs, ESM support               |
| UI Framework     | React 19.2.4                               | Latest stable, concurrent features, improved performance |
| Language         | TypeScript 5.9.3                           | Decorators, `satisfies`, const type params, better perf  |
| Build System     | electron-vite 5.0.0                        | Vite-based, fast HMR, native ESM, Electron-aware         |
| Package Manager  | pnpm                                       | Strict dependency resolution, disk-efficient, fast       |
| Database         | better-sqlite3 12.6.2 + Drizzle ORM 0.45.1 | Real SQL, type-safe queries, migrations, performance     |
| State Management | Zustand 5.0.11                             | Lightweight, maintained, no boilerplate, React 19 ready  |
| UI Components    | Ant Design 6.3.1                           | Latest, React 19 compatible, improved tree-shaking       |
| CSS              | Sass 1.97.3 (dart-sass via Vite)           | Modern, maintained, native Vite support                  |
| Testing          | Vitest 4.0.18 + Testing Library 16.3.2     | Fast (Vite-native), modern API, component testing        |
| Linting          | ESLint 10.0.2 (flat config)                | Modern config format, better performance                 |

### 3.2 Target Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│                    Main Process                       │
│                                                       │
│  src/main/index.ts                                    │
│    ├── BrowserWindow                                  │
│    │   ├── nodeIntegration: false                     │
│    │   ├── contextIsolation: true                     │
│    │   └── preload: src/preload/index.ts              │
│    ├── ipc/ (typed handlers via ipcMain.handle)       │
│    ├── database/                                      │
│    │   ├── schema.ts (Drizzle schema)                 │
│    │   ├── migrations/                                │
│    │   └── repositories/ (abstraction layer)          │
│    ├── services/                                      │
│    │   ├── backup.service.ts (Google Drive)           │
│    │   ├── updater.service.ts                         │
│    │   └── document.service.ts (PDF conversion)       │
│    └── lib/ (shared utilities)                        │
│                                                       │
│  ipcMain.handle(channel) — Promise-based              │
└──────────────────┬───────────────────────────────────┘
                   │ contextBridge (typed)
┌──────────────────┴───────────────────────────────────┐
│                   Preload Script                      │
│                                                       │
│  src/preload/index.ts                                 │
│    └── contextBridge.exposeInMainWorld('api', {...})   │
│        ├── documents.*                                │
│        ├── search.*                                   │
│        ├── notes.*                                    │
│        ├── bible.*                                    │
│        ├── subjects.*                                 │
│        ├── audio.*                                    │
│        ├── backup.*                                   │
│        ├── app.*                                      │
│        └── on.* (event listeners)                     │
│                                                       │
│  Shared types: src/shared/ipc.types.ts                │
└──────────────────┬───────────────────────────────────┘
                   │ window.api (typed)
┌──────────────────┴───────────────────────────────────┐
│                 Renderer Process                      │
│                                                       │
│  src/renderer/main.tsx                                │
│    ├── React 19.2 (createRoot)                        │
│    ├── Zustand stores/                                │
│    │   ├── useDocumentStore                           │
│    │   ├── useSearchStore                             │
│    │   ├── useNotesStore                              │
│    │   ├── useBibleStore                              │
│    │   ├── useAudioStore                              │
│    │   └── useAppStore                                │
│    ├── views/ (same feature set)                      │
│    ├── components/                                    │
│    └── hooks/                                         │
│                                                       │
│  window.api.documents.getAll() — typed calls          │
└──────────────────────────────────────────────────────┘
```

### 3.3 Directory Structure (Target)

```
wmb-table/
├── specs/                      # Refactoring specs (this document)
├── src/
│   ├── main/                   # Electron main process
│   │   ├── index.ts            # Main entry point
│   │   ├── ipc/                # IPC handlers (grouped by domain)
│   │   │   ├── documents.ipc.ts
│   │   │   ├── search.ipc.ts
│   │   │   ├── notes.ipc.ts
│   │   │   ├── bible.ipc.ts
│   │   │   ├── subjects.ipc.ts
│   │   │   ├── audio.ipc.ts
│   │   │   ├── backup.ipc.ts
│   │   │   ├── app.ipc.ts
│   │   │   └── register.ts     # Central IPC registration
│   │   ├── database/
│   │   │   ├── index.ts        # Database connection (better-sqlite3)
│   │   │   ├── schema.ts       # Drizzle ORM schema
│   │   │   ├── migrations/     # SQL migration files
│   │   │   └── repositories/   # Data access layer
│   │   │       ├── documents.repository.ts
│   │   │       ├── notes.repository.ts
│   │   │       ├── bible.repository.ts
│   │   │       ├── subjects.repository.ts
│   │   │       ├── audio.repository.ts
│   │   │       ├── history.repository.ts
│   │   │       ├── backup.repository.ts
│   │   │       └── config.repository.ts
│   │   ├── services/           # Business logic
│   │   │   ├── backup.service.ts
│   │   │   ├── updater.service.ts
│   │   │   └── document.service.ts
│   │   └── lib/                # Main process utilities
│   ├── preload/
│   │   └── index.ts            # contextBridge API
│   ├── renderer/               # React frontend
│   │   ├── main.tsx            # React entry point
│   │   ├── App.tsx             # Root component
│   │   ├── stores/             # Zustand stores
│   │   ├── views/              # Feature views
│   │   ├── components/         # Shared components
│   │   ├── hooks/              # Custom React hooks
│   │   └── styles/             # Global styles (SCSS)
│   └── shared/                 # Shared between main/renderer/preload
│       ├── ipc.types.ts        # IPC channel & payload types
│       ├── constants.ts        # Shared constants
│       └── types.ts            # Domain model types
├── resources/                  # Static assets (icons, data files)
├── drizzle/                    # Drizzle config & generated files
├── tests/                      # Test files (mirrors src/ structure)
├── electron.vite.config.ts     # electron-vite configuration
├── drizzle.config.ts           # Drizzle ORM configuration
├── eslint.config.js            # ESLint 9 flat config
├── tsconfig.json               # Root TypeScript config
├── tsconfig.main.json          # Main process TS config
├── tsconfig.preload.json       # Preload TS config
├── tsconfig.renderer.json      # Renderer TS config
├── vitest.config.ts            # Vitest configuration
├── pnpm-workspace.yaml         # pnpm workspace (if needed)
└── package.json
```

## 4. Detailed Technical Decisions

### 4.1 Electron Security Hardening

The current app has **zero process isolation**. The renderer has full Node.js access, making any XSS vulnerability equivalent to RCE.

**Changes:**

1. **`nodeIntegration: false`** — Renderer cannot `require()` Node modules
2. **`contextIsolation: true`** — Preload runs in isolated context
3. **`sandbox: true`** — Renderer runs in Chromium sandbox
4. **Preload script with `contextBridge`** — Only explicitly exposed APIs are available
5. **Content Security Policy** — Restrict script/style sources
6. **`webSecurity: true`** (default) — Enforce same-origin policy

**IPC Migration:**

| Before                                | After                              |
| ------------------------------------- | ---------------------------------- |
| `ipcRenderer.send(event, data)`       | `window.api.domain.method(data)`   |
| `ipcRenderer.on(event-reply, cb)`     | Return value from `invoke`         |
| `ipcMain.on(event, handler)`          | `ipcMain.handle(channel, handler)` |
| `event.reply(event-reply, err, data)` | Return/throw from handler          |

The typed IPC layer ensures that channel names, request payloads, and response types are all type-checked at compile time via shared types in `src/shared/ipc.types.ts`.

### 4.2 Database Migration: NeDB to better-sqlite3 + Drizzle

**Why better-sqlite3:**

- Synchronous API (no callback hell, simpler error handling)
- Real SQL with indexes, joins, transactions, FTS5 full-text search
- Battle-tested (SQLite is the most deployed database engine)
- Single file per database (easy backup/restore)
- Excellent Electron compatibility via native addon rebuild

**Why Drizzle ORM:**

- Type-safe schema definition and queries
- Zero runtime overhead (compiles to SQL)
- Built-in migration system
- Works natively with better-sqlite3
- Lightweight compared to alternatives (Prisma, TypeORM)

**Repository Abstraction Layer:**
Each domain gets a repository class that encapsulates all database operations. This provides:

- Clean separation between business logic and data access
- Easy unit testing with mock repositories
- Single place to manage transactions per domain
- Future flexibility if storage backend changes

**Migration Strategy:**

1. Define Drizzle schema matching current NeDB document shapes
2. Write a one-time migration script that reads NeDB `.db` files and inserts into SQLite
3. Store the SQLite database in `app.getPath('userData')`
4. Detect first launch after upgrade and run migration automatically

**Schema Overview (18 NeDB collections → SQLite tables):**

```
documents_title     — Document metadata (title, year, date, path)
bible_verses        — Bible text (book, chapter, verse, content)
configurations      — Key-value app settings
tabs                — Open document tabs state
suggestions         — Search suggestion cache
sidebar_status      — UI sidebar state
notes               — Note entries (title, content, timestamps)
notes_references    — Document references linked to notes
notes_bible_refs    — Bible verse references linked to notes
subjects            — Topic/subject groups
subject_items       — Items within subjects
history             — Browsing/interaction history groups
history_items       — Individual history records
custom_documents    — User-uploaded documents metadata
audio_times         — Audio playback timestamps
audio_downloads     — Downloaded audio file metadata
audio_last_play     — Last playback position per audio
backup_references   — Backup sync metadata
backup_status       — Backup state tracking
```

### 4.3 State Management: Recoil to Zustand

**Why Zustand over alternatives:**

- **Maintained** — Active development, React 19 support
- **Minimal API** — No providers, no boilerplate, just functions
- **No context re-renders** — Subscriptions are selector-based
- **TypeScript-first** — Excellent type inference
- **Devtools** — Redux DevTools compatible
- **Middleware** — persist, devtools, immer built-in

**Migration mapping:**

| Recoil Concept        | Zustand Equivalent                                      |
| --------------------- | ------------------------------------------------------- |
| `atom()`              | Store state property                                    |
| `selector()`          | Derived state via `get()` or separate selector function |
| `useRecoilState()`    | `useStore(selector)`                                    |
| `useRecoilValue()`    | `useStore(selector)` (read-only)                        |
| `useSetRecoilState()` | `useStore(s => s.setX)`                                 |
| `RecoilRoot`          | No provider needed                                      |

**Store Organization:**

- `useAppStore` — App-wide state (view, loading, sidebar)
- `useDocumentStore` — Documents, tabs, titles
- `useSearchStore` — Search state, suggestions
- `useNotesStore` — Notes, references
- `useBibleStore` — Bible navigation, search
- `useSubjectStore` — Topics/subjects
- `useAudioStore` — Audio playback state

### 4.4 Build System: Webpack to electron-vite

**Why electron-vite:**

- Purpose-built for Electron (handles main/preload/renderer)
- Vite's instant HMR for renderer
- Native ESM support
- Built-in asset handling
- Sass support out of the box (no node-sass needed)
- Significantly faster cold starts and rebuilds

**Configuration highlights:**

- Main process: Node.js target, externalize native modules (better-sqlite3)
- Preload: Node.js target, bundled separately
- Renderer: Browser target, React plugin, Sass support
- Path aliases preserved (`@main`, `@renderer`, `@shared`)

### 4.5 Data Storage Relocation

**Current locations:**

```
<install-dir>/assets/datas/           → All databases and user data
<install-dir>/assets/datas/documents/ → User-uploaded documents
<install-dir>/assets/datas/backup/    → Backup metadata
~/.wmb-table/                         → Only audio downloads DB
```

**Target locations:**

```
app.getPath('userData')/              → Base directory
  ├── databases/
  │   ├── wmb-table.sqlite            → Main SQLite database
  │   └── bible.sqlite                → Bible database (separate for size)
  ├── documents/                      → User-uploaded documents
  ├── backups/                        → Backup metadata
  └── audio/                          → Downloaded audio files

app.getPath('userData') resolves to:
  - macOS:   ~/Library/Application Support/wmb-table/
  - Windows: %APPDATA%/wmb-table/
  - Linux:   ~/.config/wmb-table/
```

**Read-only bundled assets** (stay in app resources — no data bundled):

```
resources/
  ├── icons/                          → App icons
  └── entitlements.mac.plist          → macOS entitlements
```

> **Architecture decision: User-driven data acquisition.** Documents, Bible data, and other content are **not bundled** with the app installer. Instead, data is downloaded by the user on first launch. This eliminates:
>
> - The complex updater backup/restore cycle (legacy `data-prepared.ts` etc.)
> - Large installer sizes (data can be hundreds of MB)
> - Data loss on app update (user data in `userData` is untouched by `electron-updater`)

**First-launch flow:**

1. Check if `app.getPath('userData')/databases/wmb-table.sqlite` exists
2. If not, check for legacy NeDB files at old location
3. If legacy data found: run migration script (Phase 3)
4. If no data found: show setup UI and **download data from remote source** (API/CDN)
   - Download document titles database
   - Download Bible database
   - Download document content files
   - Report progress to renderer (percentage, current file, ETA)
   - Mark setup as complete in config database once finished

**Auto-updater (simplified):**

The legacy updater (`src/main/features/app-updater/`) had a complex flow: backup data → download update → install → restore data. Since data now lives in `userData` and is never inside the app bundle, the updater is simplified to:

1. Check for update → notify renderer (`hasUpdate`)
2. User confirms → download update (`downloading` with progress)
3. Download complete → notify renderer (`downloaded`)
4. User confirms → quit and install

No backup/restore states needed. The `UpdaterNotification.type` values `preparing`, `prepared`, `restoring`, `restored`, and `restartedToUpdate` are removed.

### 4.6 CSS Migration: node-sass to dart-sass

**node-sass** is deprecated and doesn't support modern Sass features. **dart-sass** (the `sass` npm package) is the canonical implementation.

Changes:

- Replace `node-sass` with `sass` in dependencies
- Vite handles `.scss` imports natively with the `sass` package
- Update any deprecated Sass syntax (`/` for division → `math.div()`)
- Remove Webpack CSS loaders and `MiniCssExtractPlugin` (Vite handles this)

### 4.7 Testing Strategy

**Framework: Vitest + Testing Library**

- Vitest shares Vite's config and transform pipeline — no duplicate config
- Testing Library encourages testing user behavior, not implementation details
- `@testing-library/react` for component tests
- `vitest` for unit tests (repositories, services, utilities)

**Test organization:**

```
tests/
├── unit/
│   ├── main/
│   │   ├── repositories/    # Database repository tests
│   │   └── services/        # Service logic tests
│   └── shared/              # Shared utility tests
├── components/              # React component tests
└── integration/             # IPC integration tests
```

**Coverage targets:**

- Repositories: High coverage (data integrity is critical)
- Services: High coverage (business logic)
- Components: Key user flows
- IPC: Integration tests for critical channels

### 4.8 Linting & Formatting

**ESLint 9 flat config** replaces the legacy `.eslintrc` format:

- `eslint.config.js` with flat config array
- `@typescript-eslint/eslint-plugin` v8+
- `eslint-plugin-react` + `eslint-plugin-react-hooks`
- Prettier integration via `eslint-plugin-prettier`

### 4.9 Module System

The current codebase has a `modules/` directory with custom modules (context-menu, documents, shared). These will be:

- **Inlined** into `src/` where they are small utilities
- **Replaced** with maintained packages where alternatives exist
- The separate Webpack build for modules is eliminated

## 5. Migration Considerations

### 5.1 Data Integrity

- NeDB → SQLite migration must be lossless
- All 18 collections must be mapped to tables
- Timestamps (`createdAt`, `updatedAt`) preserved
- NeDB `_id` fields mapped to SQLite primary keys
- Migration is idempotent (safe to re-run)

### 5.2 Backup Compatibility

- Google Drive backup format may need versioning
- Existing backups should still be restorable
- Consider a backup format version field

### 5.3 Platform Parity

- Test on macOS, Windows, Linux
- Native module rebuilds (better-sqlite3) per platform
- Platform-specific code paths (`src/main/platforms/`) reviewed

### 5.4 Incremental Approach

The refactoring is executed in phases to maintain a working application at each stage. See `TASKS.md` for the phased execution plan.

## 6. Dependencies (Target)

### Packages to Remove (no longer needed)

The following current dependencies are **entirely removed** in the new stack:

**Build toolchain (replaced by electron-vite + Vite):**

- All `@babel/*` packages (17 packages) — Vite uses esbuild/SWC
- `webpack`, `webpack-cli`, `webpack-dev-server`, `webpack-merge`, `webpack-glob-entry`, `webpack-bundle-analyzer`
- `babel-loader`, `css-loader`, `sass-loader`, `style-loader`, `file-loader`, `url-loader`
- `mini-css-extract-plugin`, `css-minimizer-webpack-plugin`, `terser-webpack-plugin`
- `@pmmmwh/react-refresh-webpack-plugin`, `react-refresh`
- `@teamsupercell/typings-for-css-modules-loader`
- `eslint-import-resolver-webpack`
- `dotenv-webpack` (Vite has built-in env handling)
- `browserslist-config-erb`
- `cross-env` (electron-vite handles env)
- `concurrently` (electron-vite builds all targets)

**Deprecated/unmaintained packages:**

- `node-sass` → replaced by `sass` (dart-sass)
- `recoil` → replaced by `zustand`
- `enzyme`, `enzyme-adapter-react-16`, `enzyme-to-json`, `@types/enzyme*` → replaced by Testing Library
- `babel-eslint` → replaced by `@typescript-eslint/parser`
- `eslint-config-erb` → custom flat config
- `eslint-config-airbnb`, `eslint-config-airbnb-typescript` → custom flat config

**Testing (replaced by Vitest):**

- `jest`, `babel-jest`, `@types/jest`, `eslint-plugin-jest`
- `identity-obj-proxy` (Vitest handles CSS mocks natively)
- `react-test-renderer`, `@types/react-test-renderer`
- `@testing-library/jest-dom` → `@testing-library/jest-dom` (kept but used with Vitest)

**Obsolete utilities:**

- `electron-rebuild` → `electron-vite` handles native module rebuilds
- `electron-devtools-installer` → Electron 40 has built-in devtools
- `opencollective-postinstall` — unnecessary postinstall spam
- `yarn-deduplicate` — pnpm has strict deduplication built-in
- `request`, `request-progress`, `@types/request` — deprecated, use `fetch` (Node 18+ built-in)
- `regenerator-runtime` — modern Electron/Node doesn't need async polyfills
- `source-map-support` — electron-vite handles source maps
- `electron-debug` — minimal utility, inline the few lines needed
- `history`, `@types/history` — not needed (app doesn't use client-side routing)
- `core-js` — modern Electron doesn't need polyfills
- `chalk` — Node 20+ has built-in `styleText` or use `picocolors`
- `detect-port` — electron-vite handles port detection
- `rimraf` — Node 20+ has `fs.rm` with `recursive: true`
- `babel-plugin-dev-expression`, `babel-plugin-module-resolver`, `babel-plugin-transform-react-remove-prop-types` — Babel-specific, not needed with Vite
- `dotenv` — Vite has built-in `.env` file support
- `extract-zip` — evaluate if still needed or use built-in alternatives
- `fs-extra` — Node 20+ `fs/promises` covers most use cases

**Dependencies to evaluate:**

- `@ckeditor/ckeditor5-react` — Rich text editor for notes. Keep if actively used, otherwise consider lighter alternatives
- `draggabilly` — Drag library for tabs. Evaluate if still needed with modern CSS/HTML drag APIs
- `electron-notarize` → replaced by `@electron/notarize` (renamed package)

### Production

```
electron               ^40.7.0
react                  ^19.2.4
react-dom              ^19.2.4
antd                   ^6.3.1
zustand                ^5.0.11
better-sqlite3         ^12.6.2
drizzle-orm            ^0.45.1
electron-updater       ^6.8.3
electron-log           ^5.4.3
sass                   ^1.97.3
```

### Development

```
electron-vite          ^5.0.0
typescript             ^5.9.3
vite                   ^7.3.1
@vitejs/plugin-react   ^5.1.4
vitest                 ^4.0.18
@testing-library/react ^16.3.2
eslint                 ^10.0.2
drizzle-kit            ^0.31.9
electron-builder       ^26.8.1
prettier               ^3.8.1
```

---

## 7. Old `src/package.json` Dependencies Audit

The `src/package.json` contains 16 production dependencies that are separate from the root `package.json`. In the new architecture, `src/package.json` is **eliminated entirely** — all dependencies live in the root `package.json`. Below is the fate of each dependency:

| #   | Package            | Version (Current) | Action       | Replacement                                                                                          |
| --- | ------------------ | ----------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| 1   | `@seald-io/nedb`   | `^2.0.4`          | **Remove**   | `better-sqlite3@^12.6.2` + `drizzle-orm@^0.45.1`                                                     |
| 2   | `nedb`             | `^1.8.0`          | **Remove**   | Duplicate of `@seald-io/nedb`, same replacement                                                      |
| 3   | `express`          | `^4.17.1`         | **Remove**   | Was used for backup auth server — use Electron's built-in protocol handler or `utilityProcess`       |
| 4   | `firebase-admin`   | `^10.0.2`         | **Remove**   | Evaluate if still needed; if so, use modern `firebase-admin@^13`                                     |
| 5   | `fireorm`          | `^0.23.3`         | **Remove**   | Was the ORM for Firebase/Firestore — not needed without Firebase                                     |
| 6   | `googleapis`       | `39`              | **Update**   | `googleapis@^144.0.0` (pinned at v39, massively outdated)                                            |
| 7   | `request`          | `^2.88.2`         | **Remove**   | Deprecated — use native `fetch` (Node 18+ built-in)                                                  |
| 8   | `async`            | `^3.2.1`          | **Remove**   | Use native `Promise.all`, `Promise.allSettled`, async/await                                          |
| 9   | `lazy`             | `^1.0.11`         | **Remove**   | Use native iterators, generators, `Array.prototype` methods                                          |
| 10  | `underscore`       | `^1.13.1`         | **Remove**   | Use native JS methods (`map`, `filter`, `reduce`, `Object.entries`, etc.)                            |
| 11  | `reflect-metadata` | `^0.1.13`         | **Remove**   | Was required for `fireorm` decorators — not needed without fireorm                                   |
| 12  | `html-pdf`         | `^3.0.1`          | **Evaluate** | Uses deprecated PhantomJS internally — evaluate `puppeteer` or Electron's `webContents.printToPDF()` |
| 13  | `fs-extra`         | `^10.0.0`         | **Remove**   | Use `node:fs/promises` (Node 20+ covers all use cases)                                               |
| 14  | `get-folder-size`  | `^2.0.1`          | **Remove**   | Inline with `fs.readdir` recursive + stat, or drop if unused                                         |
| 15  | `is-online`        | `^9.0.1`          | **Remove**   | Inline with `fetch('https://...')` wrapped in try/catch                                              |
| 16  | `node-watch`       | `^0.7.1`          | **Replace**  | `chokidar@^4.0.3` (maintained, cross-platform)                                                       |
| 17  | `node-html-parser` | `^5.1.0`          | **Update**   | `node-html-parser@^7.1.0` (kept, version bump)                                                       |
| 18  | `uuid`             | `^8.3.2`          | **Update**   | `uuid@^11.1.0` or use `crypto.randomUUID()` (Node 19+ built-in)                                      |

**`src/package.json` devDependencies also removed:**

- `@types/async` — no longer needed
- `@types/express` — no longer needed
- `@types/get-folder-size` — no longer needed
- `@types/html-pdf` — no longer needed
- `@types/nedb` — no longer needed
- `@types/request` — no longer needed

---

## 8. New `package.json` (Complete)

This is the complete `package.json` that replaces both the root and `src/package.json`:

```json
{
  "name": "wmb-table",
  "version": "2.0.0",
  "productName": "Wmb Table",
  "description": "Gestion livres et prédications",
  "main": "./out/main/index.js",
  "author": {
    "name": "Paradoxe Ngwasi",
    "email": "paradoxngwasi@gmail.com",
    "url": "https://png-me.web.app"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/paradoxe35/wmb-table.git"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "package": "electron-vite build && electron-builder --publish never",
    "package:publish": "electron-vite build && electron-builder --publish onTagOrDraft",
    "lint": "eslint . --cache",
    "lint:fix": "eslint . --cache --fix",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "typecheck:main": "tsc --noEmit -p tsconfig.main.json",
    "typecheck:preload": "tsc --noEmit -p tsconfig.preload.json",
    "typecheck:renderer": "tsc --noEmit -p tsconfig.renderer.json",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "postinstall": "electron-vite build -b native"
  },
  "dependencies": {
    "antd": "^6.3.1",
    "better-sqlite3": "^12.6.2",
    "chokidar": "^4.0.3",
    "drizzle-orm": "^0.45.1",
    "electron-log": "^5.4.3",
    "electron-updater": "^6.8.3",
    "googleapis": "^144.0.0",
    "node-html-parser": "^7.1.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zustand": "^5.0.5"
  },
  "devDependencies": {
    "@electron/notarize": "^3.0.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@types/better-sqlite3": "^7.6.14",
    "@types/node": "^22.15.0",
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "@typescript-eslint/eslint-plugin": "^8.30.1",
    "@typescript-eslint/parser": "^8.30.1",
    "@vitejs/plugin-react": "^4.4.1",
    "drizzle-kit": "^0.31.0",
    "electron": "^35.2.1",
    "electron-builder": "^26.0.12",
    "electron-vite": "^3.1.0",
    "eslint": "^9.25.1",
    "eslint-plugin-react": "^7.37.5",
    "eslint-plugin-react-hooks": "^5.2.0",
    "globals": "^16.0.0",
    "jsdom": "^26.1.0",
    "lint-staged": "^15.5.1",
    "prettier": "^3.5.3",
    "sass": "^1.87.0",
    "simple-git-hooks": "^2.12.1",
    "typescript": "^5.8.3",
    "vite": "^6.3.4",
    "vitest": "^3.1.2"
  },
  "build": {
    "productName": "Wmb Table",
    "appId": "org.erb.wmbTable",
    "directories": {
      "buildResources": "resources",
      "output": "release"
    },
    "files": ["out/**/*"],
    "extraResources": [
      {
        "from": "resources/data",
        "to": "data"
      }
    ],
    "mac": {
      "type": "distribution",
      "hardenedRuntime": true,
      "entitlements": "resources/entitlements.mac.plist",
      "entitlementsInherit": "resources/entitlements.mac.plist",
      "gatekeeperAssess": false
    },
    "dmg": {
      "contents": [
        { "x": 130, "y": 220 },
        { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
      ]
    },
    "win": {
      "target": ["nsis", "zip"]
    },
    "nsis": {
      "oneClick": false,
      "perMachine": false,
      "allowToChangeInstallationDirectory": false,
      "installerIcon": "resources/icon.ico",
      "uninstallerIcon": "resources/icon.ico",
      "deleteAppDataOnUninstall": false
    },
    "linux": {
      "target": ["AppImage"],
      "category": "Education"
    },
    "publish": {
      "provider": "github",
      "owner": "paradoxe35",
      "repo": "wmb-table"
    }
  },
  "simple-git-hooks": {
    "pre-commit": "pnpm lint-staged"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --cache --fix"],
    "*.{js,jsx,ts,tsx,json,css,scss,md,yml,yaml}": ["prettier --write"]
  }
}
```

> **Note:** Exact version numbers should be verified against the latest available at the time of implementation. The versions above are based on the latest stable releases as of the specification date. Use `pnpm add <package>@latest` to get the true latest.

---

## 9. Configuration Files

### 9.1 `electron.vite.config.ts`

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared'),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  },
});
```

### 9.2 `tsconfig.json` (Root — Project References)

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.main.json" },
    { "path": "./tsconfig.preload.json" },
    { "path": "./tsconfig.renderer.json" }
  ]
}
```

### 9.3 `tsconfig.main.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./out/main",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@main/*": ["./src/main/*"],
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src/main/**/*", "src/shared/**/*"]
}
```

### 9.4 `tsconfig.preload.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./out/preload",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "sourceMap": true,
    "paths": {
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src/preload/**/*", "src/shared/**/*"]
}
```

### 9.5 `tsconfig.renderer.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "./out/renderer",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "jsx": "react-jsx",
    "declaration": true,
    "sourceMap": true,
    "paths": {
      "@renderer/*": ["./src/renderer/*"],
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"]
}
```

### 9.6 `eslint.config.js`

```js
import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['out/**', 'release/**', 'node_modules/**', 'resources/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
    settings: {
      react: { version: 'detect' },
    },
  },
];
```

### 9.7 `.prettierrc`

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "semi": true,
  "printWidth": 100,
  "endOfLine": "lf"
}
```

### 9.8 `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'out', 'release'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
```

### 9.9 `drizzle.config.ts`

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/main/database/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './wmb-table.sqlite',
  },
});
```

---

## 10. Files & Directories to Delete

All items below are removed during Phase 1 (build infrastructure) and Phase 8 (final cleanup). Items marked **(Phase 1)** are removed immediately when setting up the new project foundation. Items marked **(Phase 8)** are removed after all code has been migrated.

### Phase 1 — Build Infrastructure Removal

| Path                     | Type                  | Reason                                                              |
| ------------------------ | --------------------- | ------------------------------------------------------------------- |
| `.erb/`                  | Directory             | Webpack configs, scripts, mocks — replaced by `electron-vite`       |
| `babel.config.js`        | File                  | Babel config — Vite uses esbuild/SWC                                |
| `.eslintrc.js`           | File                  | Legacy ESLint config — replaced by `eslint.config.js` (flat config) |
| `.eslintignore`          | File                  | Not needed with flat config `ignores`                               |
| `clean/`                 | Directory             | Old `clean.js` build script — not needed                            |
| `hooks/`                 | Directory             | Old `restore-dev-datas.js` dev script — not needed                  |
| `modules/`               | Directory             | Custom JS modules built by Webpack — will be inlined into `src/`    |
| `modules-output/`        | Directory (if exists) | Build output for modules — not needed                               |
| `yarn.lock`              | File                  | Replaced by `pnpm-lock.yaml`                                        |
| `src/yarn.lock`          | File                  | Sub-package lock — eliminated with single root `package.json`       |
| `src/package.json`       | File                  | Sub-package — all deps moved to root `package.json`                 |
| `src/dev-app-update.yml` | File                  | Old electron-updater dev config                                     |
| `tmp/`                   | Directory             | Temporary dev files — not needed in repo                            |

### Phase 8 — Legacy Source Code Removal

| Path                         | Type      | Reason                                                             |
| ---------------------------- | --------- | ------------------------------------------------------------------ |
| `src/main.dev.ts`            | File      | Old main process entry point                                       |
| `src/index.tsx`              | File      | Old renderer entry point                                           |
| `src/index.html`             | File      | Old HTML template — electron-vite generates its own                |
| `src/app.global.scss`        | File      | Migrated to `src/renderer/styles/`                                 |
| `src/sys.ts`                 | File      | Old system utilities — inlined into new structure                  |
| `src/ipc/`                   | Directory | Old IPC layer (`ipc-main.ts`, `ipc-renderer.ts`)                   |
| `src/utils/`                 | Directory | Old utilities (`ipc-events.ts`, etc.)                              |
| `src/types/`                 | Directory | Old type definitions — migrated to `src/shared/`                   |
| `src/main/db/`               | Directory | NeDB database layer — replaced by SQLite + Drizzle                 |
| `src/main/message-control/`  | Directory | Old 77-event IPC handlers — replaced by typed `ipc/` handlers      |
| `src/main/childs_processes/` | Directory | Old child process scripts — replaced by `utilityProcess`           |
| `src/main/platforms/`        | Directory | Platform-specific code — migrated to new location                  |
| `src/renderer/store/`        | Directory | Recoil store — replaced by Zustand stores                          |
| `assets/datas/`              | Directory | User data in install dir — moved to `app.getPath('userData')`      |
| `assets/datas/credentials/`  | Directory | Bundled OAuth credentials — security risk, moved to secure storage |

### Root Config Files to Remove

| Path            | Reason                                                    |
| --------------- | --------------------------------------------------------- |
| `.env.exemple`  | Rename to `.env.example` or remove if Vite `.env` is used |
| `.editorconfig` | Keep (still useful) or update for new conventions         |

> **Note:** The `assets/` directory itself is restructured into `resources/` — app icons, entitlements, and bundled read-only data move to `resources/`. The `assets/datas/` subdirectory is the part being removed (user data relocated to OS paths).
