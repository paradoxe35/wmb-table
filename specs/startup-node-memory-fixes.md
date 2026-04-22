# Startup Node Memory Fixes

Last reviewed: 2026-04-21
Scope: startup RAM reduction without relying on lazy-rendered views or unmounting UI components
Goal: reduce immediate post-launch memory usage with low-regression backend and boot-payload changes

## Constraints

- Do not depend on unmounting hidden views as the primary fix.
- Do not break search, Bible access, sermon audio, saved tabs, or installed-language handling.
- Prefer changes that reduce memory at process start or first renderer hydration.

## Memory Policy

- Load only what is needed for the current screen, current language, or current document.
- Prefer one-item-at-a-time or page-at-a-time loading over full-library hydration.
- Every cache must have a bound:
- item-count bound
- byte-size bound
- or active-item-only semantics
- Every heavy resource must have a release path:
- close inactive Tantivy indexes
- evict inactive document payloads
- avoid keeping duplicate copies of the same metadata
- Do not couple “installed”, “available”, or “known” with “opened in memory”.
- Avoid boot payloads that include large repeated strings or nested arrays when those can be fetched on demand.

## Verified Startup Sources

### 1. Eager Tantivy index loading for every installed language

Files:

- `src/main/index.ts:125-143`
- `src/main/services/tantivy.service.ts:85-105`
- `src/main/services/tantivy-worker/shared.ts:129-188`
- `src/main/services/language-pack.service.ts:454-480`

What happens:

- On app startup, `initializeTantivy()` runs before the window is shown.
- The worker scans the whole indexes directory and opens every installed index into `indexCache`.
- `languages.getInstalled()` depends on `tantivyService.getInstalledLanguages()`, so “what is installed?” is coupled to “what is opened in memory?”.

Why this matters:

- This is the most important verified main-process startup memory issue.
- Memory scales with all installed languages, not the active language.

### 2. Full active-language sermon workspace is loaded into renderer on boot

Files:

- `src/renderer/hooks/index.ts:149-160`
- `src/renderer/hooks/index.ts:215-266`
- `src/main/ipc/documents.ipc.ts:9-12`
- `src/main/services/reference-data.service.ts:78-127`
- `src/renderer/stores/sermon.store.ts:24-37`

What happens:

- Boot loads `documents.getTitles(activeLanguage)`.
- That returns the full deduplicated sermon list for the active language.
- Each sermon record includes `availableTranslations` and `audioLink`.
- Renderer then stores the same dataset as `sermons`, `sermonsById`, and `sermonsByYear`.

Why this matters:

- This is the largest verified renderer-side startup payload.
- It grows before the user opens Notes, AI chat, or other heavy screens.

### 3. Reference DB and active Bible DB are opened with large mmap budgets at startup

Files:

- `src/main/database/index.ts:42-70`
- `src/main/database/reference-db.ts:14-19`
- `src/main/services/bible.service.ts:298-306`

What happens:

- Startup opens main DB, sync DB, bundled reference DB, and active Bible DB.
- Reference DB and Bible DB both use `mmap_size = 268435456` and `cache_size = -10000`.

Why this matters:

- Depending on the OS memory view, this can inflate RSS or apparent memory immediately after launch.
- Combined with open Tantivy indexes, this can explain very high startup memory even before user interaction.

### 4. Installed-language enumeration does more work than startup needs

Files:

- `src/renderer/hooks/index.ts:218-229`
- `src/main/services/language-pack.service.ts:454-480`

What happens:

- Renderer boot asks for installed languages.
- That path computes sermon counts and recursively walks each index directory to compute `sizeOnDisk`.

Why this matters:

- More startup CPU and allocation churn than necessary.
- Not likely the top retained-memory issue, but still part of the boot path.

### 5. Sync can add startup runtime state when backup is enabled

Files:

- `src/main/index.ts:142-143`
- `src/main/services/sync/synchronizer.ts:78-89`
- `src/main/services/sync/synchronizer.ts:126-149`

What happens:

- Startup always calls `tryStartSynchronizer()`.
- If backup is active and stored credentials exist, the app creates a `GoogleDriveService`, keeps an auth client in memory, starts a 30-second timer, and immediately runs a sync cycle.

Why this matters:

- This is not a universal startup cost, but it is real for backup-enabled users.
- It adds long-lived runtime state and can trigger snapshot/download work soon after boot.

## Recommended Fixes

### [x] Priority 1 - Decouple installed-language discovery from opened Tantivy indexes

Implementation:

- Introduce a lightweight installed-language source that does not require opening indexes.
- Use either:
- `language_sources` records as the primary installed-language registry, with a disk existence check.
- Or a direct filesystem scan of `indexesDir` for valid language folders containing `meta.json`.
- Keep `tantivyService.getInstalledLanguages()` for loaded/open indexes only, not installed indexes.

Why this is safe:

- It separates discovery from runtime search state.
- Search behavior does not need to change.

Expected impact:

- Enables the next fix: lazy index opening at the service level.

Status:

- Implemented.
- Installed languages are now discovered from disk instead of worker-opened indexes.

### [x] Priority 2 - Do not preload Tantivy indexes at startup

Implementation:

- Change startup so `initializeTantivy()` creates the worker but does not open any indexes.
- Open the requested language on demand when a search or sermon-content operation requires it.
- Add an explicit close policy for inactive indexes, ideally LRU or “active-only”.

Why this is safe:

- Search semantics stay the same; only load timing changes.
- Cross-language flows can still open required indexes explicitly.

Watchpoints:

- language switching
- search right after app launch
- installing/deleting language packs
- sermon content fetches for non-active languages

Expected impact:

- Highest likely main-process startup RAM win.

Status:

- Implemented.
- Startup now initializes the Tantivy worker with zero loaded indexes.
- Language indexes load only on demand and idle indexes are evicted instead of accumulating.

### [x] Priority 3 - Stop using full sermon workspace as the boot payload

Implementation:

- Split the current `documents.getTitles()` response into:
- a minimal boot list for sidebar rendering
- and targeted follow-up lookups for heavier fields
- Keep boot payload limited to fields needed for the initial sidebar and tab restoration.
- Move `availableTranslations` lookup to per-sermon fetch or compact it heavily.
- Move `audioLink` resolution to per-sermon or per-playback fetch instead of embedding long URLs in every boot record.

Why this is safe:

- It changes payload shape, not feature behavior.
- The sidebar, open tab restoration, and sermon header can continue working with targeted lookups.

Watchpoints:

- sidebar expand/collapse
- translation switcher in sermon header
- audio button availability
- tab hydration and title resolution

Expected impact:

- Large renderer boot-memory reduction.

Status:

- Implemented.
- `documents.getTitles()` now returns a lighter sermon summary payload for boot hydration instead of the full sermon meta shape.
- Full sermon audio URLs stay in the per-sermon content/meta fetch path instead of the startup workspace payload.

### [x] Priority 4 - Remove renderer duplication of sermon metadata at startup

Implementation:

- Keep one canonical sermon collection in store state.
- Build `sermonsById` and `sermonsByYear` lazily, or compute them on first use and cache them.
- If both are required, store only compact indices instead of full repeated objects.

Why this is safe:

- No UI behavior change required.
- This is pure data-shape optimization.

Expected impact:

- Direct reduction in retained renderer heap after boot.

Status:

- Implemented.
- Renderer store now keeps one canonical sermon list, and the ID/year views are derived from that list instead of being retained as duplicate store state.

### [x] Priority 5 - Shrink or defer startup `audioLink` materialization

Implementation:

- Replace full absolute audio URLs in `SermonMeta` boot payload with a smaller key:
- sermon id + language code
- or a compact server-side audio identifier
- Resolve the full URL only when playback or audio UI actually needs it.

Why this is safe:

- Audio playback behavior can remain unchanged.
- Existing persistence already keys off `audioLink`, so migration needs care if the identifier changes.

Watchpoints:

- saved playback position lookup
- cached audio reuse
- mini-player behavior
- audio resume after reopen

Expected impact:

- Moderate to high if sermon lists are large, because repeated long strings are expensive.

Status:

- Implemented.
- Startup sermon boot payload now carries `hasAudio` for sidebar display and defers full `audioLink` resolution to `getSermonContent()` and other targeted meta lookups.
- Boot metadata still includes `audioLink`.

### [~] Priority 6 - Reduce or delay reference/Bible DB mmap budgets

Implementation:

- Measure current RSS with both DBs open.
- If meaningful, reduce `mmap_size` and/or `cache_size`.
- Prefer adaptive sizing:
- smaller defaults on startup
- larger budgets only after a feature proves it needs them
- Consider delaying active Bible DB open until first Bible operation if startup measurements show it matters.

Why this is safe:

- Behavior stays the same if query latency remains acceptable.

Watchpoints:

- Bible chapter open latency
- sermon metadata query latency
- low-memory systems

Status:

- Partially implemented.
- Reference DB and Bible DB mmap/cache defaults were reduced.
- Active Bible DB opening is now delayed until first actual Bible access.
- Reference DB is still opened at startup, so this area is improved but not fully minimized.

Expected impact:

- Can materially reduce startup process memory accounting.

### [ ] Priority 7 - Remove heavy installed-language extras from the boot request

Implementation:

- `languages.getInstalled()` used during startup should return only what startup needs:
- language code
- labels
- update flag if already known
- Defer `sizeOnDisk` and exact sermon counts to the library/settings screen.

Why this is safe:

- Startup only needs to know whether the saved content language is still installed.

Expected impact:

- Lower startup churn and less filesystem traversal.

### [ ] Priority 8 - Move language-pack update checks off the critical startup path

Implementation:

- Keep the background update check, but do not schedule it until after first paint or an idle delay.
- Avoid parallel HEAD requests immediately during boot.

Why this is safe:

- Update availability is not startup-critical.

Expected impact:

- Mainly CPU/network cleanup, not likely a large retained-RAM win.

### [ ] Priority 9 - Keep synchronizer startup conditional and cold by default

Implementation:

- Keep `tryStartSynchronizer()` no-op unless backup is active and credentials exist.
- If startup memory is still high on backup-enabled installs, delay `startSynchronizer()` until after first paint.

Why this is safe:

- Sync still runs automatically, just not on the critical memory path.

Expected impact:

- Situation-dependent, useful only for backup-enabled users.

### [ ] Priority 10 - Stream sync snapshots instead of buffering full files in memory

Implementation:

- Replace whole-buffer snapshot pull/push with streaming pipelines.
- On upload:
- avoid `readFile(mainDb.name)` plus `gzipAsync(dbContent)` when creating snapshots
- stream database file to gzip to Drive upload body
- On download:
- avoid `getFileContent()` returning a full `Buffer` for snapshots
- stream Drive response through gunzip directly into a temp file

Files:

- `src/main/services/sync/synchronizer.ts:392-399`
- `src/main/services/sync/synchronizer.ts:549-552`
- `src/main/services/sync/drive.service.ts:56-64`
- `src/main/services/sync/drive.service.ts:159-164`

Why this is safe:

- Snapshot semantics stay the same.
- The change is about transport and buffering strategy, not sync behavior.

Watchpoints:

- snapshot integrity
- temp-file cleanup on cancellation/failure
- Drive upload/download retry behavior

Expected impact:

- Large reduction in temporary Node memory spikes during sync cycles.

### [ ] Priority 11 - Bound sync backlog processing and metadata retention

Implementation:

- Process remote change pages incrementally instead of collecting all matching files into one array.
- Avoid building large in-memory file lists when a user has a long unsynced history.
- Consider chunked offset advancement and chunked processed-file application.

Files:

- `src/main/services/sync/drive.service.ts:78-102`
- `src/main/services/sync/synchronizer.ts:293-345`

Why this is safe:

- It preserves sync ordering while reducing peak memory during backlog recovery.

Watchpoints:

- exact chronological application order
- processed-file bookkeeping
- snapshot/change interleaving

Expected impact:

- Better bounded memory during large sync recoveries.

## Changes That Are Probably Not Worth Prioritizing First

### [ ] Note - AI service startup

Status:

- `AiService` is lazy via `getAiService()`.
- Local model runtime is not loaded at app boot by default.

### [ ] Note - TTS service startup

Status:

- `TtsService` is lazy via `getTtsService()`.
- Sherpa does not preload all installed models at startup.

### [ ] Note - Language-pack archive extraction

Status:

- Downloads and extraction are already disk-backed and streamed.
- This is not the cause of high immediate startup memory.

## Suggested Rollout Order

1. Decouple installed-language discovery from loaded Tantivy indexes.
2. Open only active-language Tantivy index at startup.
3. Slim the boot-time sermon workspace payload.
4. Remove startup duplication in the sermon store.
5. Re-measure.
6. Then tune reference/Bible DB mmap budgets if startup RSS is still too high.

## Verification Checklist

### [ ] Measure startup memory before changes

Capture:

- Electron main RSS
- Tantivy worker RSS if visible separately
- renderer RSS / JS heap
- startup time to first usable paint

### [ ] Verify language behavior

Check:

- saved content language restoration
- language switching
- install/delete language pack
- search after startup

### [ ] Verify sermon workspace behavior

Check:

- sidebar population
- tab restoration
- sermon title resolution
- translation switcher
- sermon audio button and playback

### [ ] Verify Bible behavior

Check:

- active version restore
- chapter open
- version switch
- no missing fallback Bible language
