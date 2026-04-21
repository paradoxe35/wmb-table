# Memory And Performance Audit

Last reviewed: 2026-04-21
Scope: `src/renderer`, `src/main`, `src/preload`
Goal: reduce RAM usage and improve responsiveness without changing user-visible behavior.

## How To Use This File

- Each item starts unchecked: `[ ]`
- When a fix is implemented and verified, mark it: `[x]`
- `Type` is for triage:
    - `Fix candidate`: should likely become engineering work
    - `Investigate`: confirm with heap/profile data before changing behavior
    - `Note`: important context, but not necessarily a code change

## Guardrails

Any optimization work from this audit should preserve:

1. Search behavior, search highlighting, and result ordering.
2. Reading position restoration, zoom, tab persistence, and pending navigation.
3. TTS correctness, paragraph highlighting, and sermon audio playback handoff.
4. Notes editor reliability, reference insertion/removal, and autosave.
5. AI chat history correctness, streaming behavior, queued messages, and export.
6. Bible version switching, download flow, and fallback language behavior.

Recommended validation before and after each fix:

1. Capture a renderer heap snapshot after startup, after opening Notes, after opening AI chat, and after returning to document view.
2. Compare Electron process RSS and renderer heap before and after each change.
3. Run smoke checks for document view, Notes, AI chat, search, TTS, sermon audio, Bible, and settings.

## Highest Priority

### [ ] Pending - Unmount inactive option panels instead of hiding them

Type: Fix candidate
Priority: Critical
Area: Renderer memory root
Files: `src/renderer/content-app.tsx:45-105`, `src/renderer/content-app.tsx:107-147`, `src/renderer/components/load-by-visibility.tsx:4-40`
Concern:
`AppOptions` creates every option page once and then hides inactive pages with CSS. `LoadByVisibility` only lazy-loads once; it never unloads. After a user visits Notes, AI chat, Settings, Highlights, Bible, History, or Subjects, those trees stay mounted for the rest of the session.
Impact:
This is the single most important renderer memory issue. It turns one renderer into several heavy apps living at once.
Safe optimization direction:
Mount only the active option view. Persist required state in stores so unmounting does not lose user context. If a full unmount is too aggressive for some views, introduce an explicit keep-alive allowlist instead of keeping everything alive by default.
Regression watchpoints:
draft text in AI chat input, note editor unsaved state, scroll position inside option pages, background refresh listeners, modal ownership.

### [ ] Pending - Do not keep CKEditor alive after leaving Notes

Type: Fix candidate
Priority: Critical
Area: Renderer heavy component lifetime
Files: `src/renderer/views/options/notes/editor.tsx:32-37`, `src/renderer/views/options/notes/editor.tsx:799-908`, `src/renderer/views/options/notes.tsx:1-42`
Concern:
The CKEditor bundle is loaded into the renderer and the editor instance is mounted in the Notes option view. Because the Notes page is hidden rather than unmounted, the editor and its plugin/toolbar graph stay resident after the user leaves Notes.
Impact:
Very high steady-state memory cost after the first Notes visit.
Safe optimization direction:
Make Notes unmount when inactive. If required, separate note metadata from editor state so reopening Notes reconstructs the editor from persisted content instead of keeping the editor instance alive.
Regression watchpoints:
autosave timing, imported document flow, reference context menus, rename modal timing, read-only toggle, toolbar placement.

### [ ] Pending - Prune AI chat state and fix deleted-conversation retention

Type: Fix candidate
Priority: Critical
Area: Renderer state retention
Files: `src/renderer/stores/ai-chat.store.ts:348-358`, `src/renderer/stores/ai-chat.store.ts:735-845`, `src/renderer/stores/ai-chat.store.ts:879-956`, `src/renderer/stores/ai-chat.store.ts:959-1249`
Concern:
The renderer keeps `messagesByConversation`, `historyByConversation`, `loading*` maps, `conversationRuns`, queued messages, and `reasoningByMessage` for previously opened conversations. `selectConversation` never evicts loaded conversations. `deleteConversation` removes message maps but does not remove reasoning strings associated with deleted message ids.
Impact:
Memory grows with chat usage and can keep growing even after conversations are deleted.
Safe optimization direction:
Add bounded retention for inactive conversations. Remove reasoning entries when conversations are deleted or cleared. Consider keeping only the active conversation plus a small LRU of recently viewed conversations in memory.
Regression watchpoints:
conversation switching latency, queued message recovery, retry-last-message behavior, stream completion/cancel/error flows, PDF export.

### [ ] Pending - Virtualize AI chat message rendering

Type: Fix candidate
Priority: Critical
Area: Renderer DOM growth
Files: `src/renderer/views/options/ai-chat/chat-message-list.tsx:136-359`, `src/renderer/views/options/ai-chat/index.tsx:38-216`
Concern:
Every loaded chat message is rendered at once with markdown parsing, animated wrappers, tool result UI, and sticky-scroll observers.
Impact:
Large conversations create a large DOM tree and a large React object graph. RAM and commit time scale linearly with chat history size.
Safe optimization direction:
Use list virtualization for messages, with special handling for active streaming message height changes. Keep markdown rendering only for visible rows.
Regression watchpoints:
scroll-to-bottom behavior, loading older messages, queued messages, active typing indicator, message retry button, markdown anchors.

### [ ] Pending - Virtualize long sermon and Bible paragraph lists

Type: Fix candidate
Priority: Critical
Area: Renderer content rendering
Files: `src/renderer/views/document-view/sermon-document-view.tsx:63-70`, `src/renderer/views/document-view/sermon-document-view.tsx:202-239`, `src/renderer/views/document-view/tts-controls.tsx:136-241`, `src/renderer/hooks/use-tts-highlight.ts:3-21`, `src/renderer/views/document-view/sermon-paragraph.tsx:178-248`
Concern:
Every paragraph is mounted at once. Each `TtsParagraph` subscribes to TTS store state, and each paragraph rebuilds highlight ranges and markup when relevant props change.
Impact:
Long documents create high DOM and subscription counts. TTS state changes can fan out across hundreds or thousands of paragraph components.
Safe optimization direction:
Introduce windowed rendering for paragraph lists. Keep a stable paragraph identity model so search navigation, pending navigation, TTS highlight, and context menu references still work.
Regression watchpoints:
scroll restoration, paragraph navigation modal, TTS auto-scroll, search match highlighting, highlight creation ranges, context menu targeting.

## High Priority

### [ ] Pending - Remove layout scanning from render path in document body

Type: Fix candidate
Priority: High
Area: Renderer layout thrash
Files: `src/renderer/views/document-view/document-body.tsx:49-86`
Concern:
`DocumentBody` computes anchor state during render by calling `querySelector`, `querySelectorAll`, and `getBoundingClientRect()` across paragraph elements.
Impact:
This can force layout work during render and scales badly with document length.
Safe optimization direction:
Move anchor capture into a layout effect or explicit pre-transition step. Avoid scanning every paragraph on normal renders.
Regression watchpoints:
reading mode toggle, zoom, pending navigation, TTS active paragraph anchoring.

### [ ] Pending - Replace entry-count caches with memory-budgeted caches

Type: Fix candidate
Priority: High
Area: Renderer cache policy
Files: `src/renderer/views/document-view/hooks/document-content-hooks.ts:12-24`, `src/renderer/views/document-view/hooks/document-content-hooks.ts:106-156`, `src/renderer/views/document-view/hooks/document-content-hooks.ts:159-203`, `src/renderer/views/document-view/hooks/document-content-hooks.ts:205-256`
Concern:
Sermon, Bible, and custom-document caches are capped only by entry count (`50`), not by payload size. Large documents can still consume a lot of heap.
Impact:
Users who browse many large sermons or documents can keep a large retained content cache in the renderer.
Safe optimization direction:
Use a smaller cache, size-aware eviction, or evict on tab close. Avoid duplicating cached content in both a module cache and store state unless needed.
Regression watchpoints:
tab switching latency, document reopen latency, offline custom documents, reading position restore timing.

### [ ] Pending - Reduce duplicated sermon metadata in renderer startup state

Type: Fix candidate
Priority: High
Area: Renderer idle baseline
Files: `src/renderer/hooks/index.ts:149-160`, `src/renderer/hooks/index.ts:215-266`, `src/main/ipc/documents.ipc.ts:9-12`, `src/main/services/reference-data.service.ts:78-127`, `src/renderer/stores/sermon.store.ts:17-40`
Concern:
App init loads the full active-language sermon title workspace during boot via `documents.getTitles()`, then stores that metadata in three shapes at once: `sermons`, `sermonsById`, and `sermonsByYear`.
Impact:
Higher idle renderer memory before the user opens any heavy feature. This is one of the strongest verified causes of large immediate post-launch memory use.
Safe optimization direction:
Keep one canonical collection and derive secondary indexes lazily or on demand. Consider booting with a slimmer sidebar payload and loading translation arrays or secondary indexes only when needed.
Regression watchpoints:
sidebar loading, year-grouped browsing, default first-tab behavior, cross-language translation lookup.

### [ ] Pending - Avoid renderer-wide retention of hidden listeners and background UI work

Type: Fix candidate
Priority: High
Area: Renderer hidden work
Files: `src/renderer/content-app.tsx:45-105`, `src/renderer/views/options/ai-chat/index.tsx:69-71`, `src/renderer/views/options/notes.tsx:20-31`
Concern:
Because option pages stay mounted, their hooks, event listeners, observers, and data subscriptions stay active while hidden.
Impact:
Extra CPU churn, memory retention, and surprise background work when the user is not on that screen.
Safe optimization direction:
Once inactive views unmount, most of this disappears automatically. For views that must stay mounted, gate expensive effects behind active-view checks.
Regression watchpoints:
AI stream event handling, note refresh events, settings update listeners.

### [ ] Pending - Keep AI chat store slices smaller in the view layer

Type: Fix candidate
Priority: High
Area: Renderer rerender pressure
Files: `src/renderer/views/options/ai-chat/index.tsx:38-216`
Concern:
`AiChatView` subscribes to many large store slices at once, including whole conversation maps and message maps.
Impact:
Large store objects increase rerender cost and can keep more data live through closures and component state.
Safe optimization direction:
Narrow selectors and move derived lookups closer to the subcomponents that need them.
Regression watchpoints:
message send flow, conversation selection, loading flags, queued messages.

## Medium Priority

### [ ] Pending - Treat search rendering as a performance budget, not just a feature budget

Type: Fix candidate
Priority: Medium
Area: Renderer search
Files: `src/renderer/views/options/search/search-view.tsx:14-80`, `src/renderer/views/options/search/search-result-list.tsx:1-96`
Concern:
Search is paginated to 20 items, which is good, but each query rebuilds full result objects and UI without reuse. This is more of a responsiveness issue than a leak.
Impact:
Not likely the main RAM driver, but still worth keeping lean as other fixes land.
Safe optimization direction:
Keep result objects small and avoid unnecessary remounts across page changes.
Regression watchpoints:
pagination, exact/approximate totals, result highlighting.

### [ ] Pending - Avoid repeated full-string work in paragraph rendering

Type: Fix candidate
Priority: Medium
Area: Renderer text processing
Files: `src/renderer/views/document-view/sermon-paragraph.tsx:119-171`, `src/renderer/views/document-view/sermon-paragraph.tsx:193-235`
Concern:
Each paragraph rebuilds highlight arrays and splits content into React nodes on every relevant render.
Impact:
This adds allocation churn on long documents, especially during search and TTS updates.
Safe optimization direction:
After virtualization, memoize more aggressively around visible rows and precomputed highlight data.
Regression watchpoints:
overlapping search highlights, persistent highlights, TTS sentence highlight.

### [ ] Pending - Review renderer audio preview caches and blob URL cleanup

Type: Investigate
Priority: Medium
Area: Renderer media lifetime
Files: `src/renderer/services/tts-audio-player.ts:23-184`, `src/renderer/views/options/settings/tts-reference-voices.tsx`
Concern:
The TTS preview path creates blob URLs and `Audio` objects. Some cleanup exists, but this path should be verified with heap snapshots because media objects often linger longer than expected.
Impact:
Probably not the primary RAM issue, but worth validating while profiling.
Safe optimization direction:
Confirm all blob URLs are revoked and all audio objects are dereferenced when previews stop or components unmount.
Regression watchpoints:
preview replay, pause/resume, rapid voice switching.

## Main Process Hotspots

### [ ] Pending - Keep local AI model residency under tighter control

Type: Fix candidate
Priority: High
Area: Main process singleton memory
Files: `src/main/services/ai/local/local-runtime.service.ts:15-145`, `src/main/services/ai/ai.service.ts:103-115`, `src/main/services/ai/ai.service.ts:383-390`
Concern:
`LocalRuntimeService` keeps the loaded GGUF model resident for up to five minutes after use. That model can be the largest single memory consumer in the app.
Impact:
When local AI is used even once, main-process RSS can remain very high long after the user stops using it.
Safe optimization direction:
Make idle disposal shorter, configurable, or tied to actual AI feature activity. Consider disposing immediately when the active provider changes away from `local`.
Regression watchpoints:
first-token latency for repeated prompts, GPU reload stability, in-flight abort behavior.

### [ ] Pending - Do not open and retain every Tantivy index at startup unless needed

Type: Fix candidate
Priority: High
Area: Main process worker memory
Files: `src/main/index.ts:125-143`, `src/main/services/tantivy.service.ts:44-49`, `src/main/services/tantivy.service.ts:85-105`, `src/main/services/tantivy-worker/shared.ts:21-22`, `src/main/services/tantivy-worker/shared.ts:129-188`, `src/main/services/language-pack.service.ts:395-405`
Concern:
The Tantivy worker is initialized at startup and opens all installed language indexes into `indexCache`. The language-pack install flow also calls `openIndex()` immediately after installing a pack, so a newly installed language becomes resident right away.
Impact:
Main-process worker memory scales with installed language count, not with currently active language.
Safe optimization direction:
Load only the active language index at startup and open others lazily. Keep an explicit close policy for inactive indexes.
Regression watchpoints:
language switching latency, background language install flow, search availability immediately after startup.

### [ ] Pending - Reject outstanding Tantivy requests on shutdown or worker restart

Type: Fix candidate
Priority: Medium
Area: Main process lifecycle correctness
Files: `src/main/services/tantivy.service.ts:46-64`, `src/main/services/tantivy.service.ts:183-189`
Concern:
`terminateWorker()` clears `pending` without rejecting the associated promises.
Impact:
This is more of a shutdown correctness issue than a steady-state RAM issue, but unresolved promises can hide lifecycle bugs and stranded work.
Safe optimization direction:
Reject all pending calls with a specific worker-terminated error before clearing the map.
Regression watchpoints:
app quit, language pack install/reload flows, tests that await worker results.

### [ ] Pending - Reject outstanding TTS worker RPC requests on dispose

Type: Fix candidate
Priority: Medium
Area: Main process worker lifecycle correctness
Files: `src/main/services/tts/worker-rpc.ts:18-68`, `src/main/services/tts/sherpa.provider.ts:372-375`
Concern:
`WorkerRpc.dispose()` terminates the worker and clears `pending` without rejecting in-flight requests. If disposal happens during model initialization, synthesis, or model download, callers can be left waiting on promises that never settle.
Impact:
Mostly a lifecycle and correctness issue, but unresolved promises can retain closures and make shutdown or provider-switch paths harder to reason about.
Safe optimization direction:
Reject every pending request with a specific worker-disposed error before clearing the map.
Regression watchpoints:
app quit, TTS provider switching, Sherpa model delete/download flows, rapid start-stop behavior.

### [ ] Pending - Reduce base64 audio traffic between main and renderer during TTS playback

Type: Fix candidate
Priority: High
Area: Main + renderer cross-process memory amplification
Files: `src/main/services/tts/tts.service.ts:177-195`, `src/main/services/tts/tts.service.ts:483-606`, `src/main/services/tts/tts-cache.ts:41-68`
Concern:
The TTS service reads audio from disk into memory, converts it to base64, and sends it over IPC for the current segment and queued lookahead segments.
Impact:
This duplicates audio payloads across main-process memory, IPC serialization, renderer memory, blob conversion, and audio element decoding.
Safe optimization direction:
Move toward file-backed or stream-backed playback for queued TTS audio instead of base64 IPC payloads. Do this carefully and incrementally because TTS correctness matters more than raw optimization.
Regression watchpoints:
segment order, pause/resume, seek, playback speed changes, cache hit behavior, browser-vs-remote provider parity.

### [ ] Pending - Re-check main-process TTS prefetch depth after profiling

Type: Investigate
Priority: Medium
Area: Main process burst allocation
Files: `src/main/services/tts/tts.service.ts:82-93`, `src/main/services/tts/tts.service.ts:477-524`
Concern:
Lookahead prefetch depth is fixed at `4`. With large audio segments or slow providers, this may over-buffer.
Impact:
Potential burst memory growth during playback.
Safe optimization direction:
Profile real sessions first. If needed, make lookahead adaptive by segment size or provider type.
Regression watchpoints:
gapless playback, latency after each segment, provider rate limits.

### [ ] Pending - Review active Bible DB memory budget

Type: Investigate
Priority: Medium
Area: Main process database residency
Files: `src/main/services/bible.service.ts:26-28`, `src/main/services/bible.service.ts:298-318`, `src/main/services/bible.service.ts:405-428`
Concern:
The active Bible database stays open and uses `mmap_size = 268435456` and `cache_size = -10000`. This may be acceptable, but it is a meaningful standing memory budget.
Impact:
Can increase main-process RSS, especially alongside local AI or open search indexes.
Safe optimization direction:
Measure before changing. If this is a meaningful contributor, reduce mmap/cache values or make them conditional on platform and file size.
Regression watchpoints:
Bible query latency, switching versions, repeated verse lookups.

### [ ] Pending - Review reference DB mmap budget at startup

Type: Investigate
Priority: Medium
Area: Main process startup memory accounting
Files: `src/main/database/reference-db.ts:14-19`, `src/main/database/index.ts:64-69`
Concern:
The bundled reference DB is opened at app startup with `mmap_size = 268435456` and `cache_size = -10000`.
Impact:
This can materially increase startup RSS or memory-accounting numbers, especially when combined with the Bible DB and open Tantivy indexes. Depending on the OS memory view being used, it may make the app look much larger immediately after launch even before the renderer does much work.
Safe optimization direction:
Measure first. If this is a meaningful contributor, reduce mmap budget, make it adaptive to platform or DB size, or delay some read-heavy work until after startup.
Regression watchpoints:
startup latency, reference lookup latency, document title loading, search-related metadata lookups.

### [ ] Pending - Avoid expensive installed-language enumeration during renderer boot

Type: Fix candidate
Priority: Medium
Area: Startup CPU and allocation churn
Files: `src/renderer/hooks/index.ts:218-229`, `src/main/services/language-pack.service.ts:454-480`
Concern:
Renderer startup calls `languages.getInstalled()`, and that path computes per-language disk size recursively and sermon counts before the main workspace load begins.
Impact:
More startup work and temporary allocations than necessary. This is probably not the largest retained-memory issue, but it adds avoidable churn to the boot path.
Safe optimization direction:
Return a lighter installed-language payload during boot, or defer `sizeOnDisk` until the library/settings screen needs it.
Regression watchpoints:
library modal counts, update badges, startup language validation flow.

### [ ] Pending - Keep AI context construction on a strict budget

Type: Fix candidate
Priority: Medium
Area: Main process prompt-building overhead
Files: `src/main/services/ai/context-memory.ts:18-54`, `src/main/services/ai/context-memory.ts:570-620`, `src/main/services/ai/ai.service.ts:530-555`, `src/main/services/ai/ai.service.ts:651-658`
Concern:
Per generation, the app loads up to 40 recent messages, formats them, estimates tokens, builds compacted summaries, and then repeats context construction after generation to refresh the summary.
Impact:
More CPU and temporary allocation pressure during chat generation, especially for conversations with tool-rich messages.
Safe optimization direction:
Cache or incrementally maintain summaries instead of fully rebuilding context twice per run where possible.
Regression watchpoints:
summary quality, retry behavior, title generation inputs, tool-result context fidelity.

### [ ] Pending - Verify background audio caching does not multiply unnecessary downloads

Type: Investigate
Priority: Low
Area: Main process background work
Files: `src/main/services/audio-cache.service.ts:8-14`, `src/main/services/audio-cache.service.ts:33-109`
Concern:
Background audio caching is fire-and-forget and dedupes only by exact URL in the current process.
Impact:
This is more network/disk pressure than RAM pressure, but it can still add temporary buffers and background activity.
Safe optimization direction:
Confirm whether duplicate cache requests happen often in practice before changing.
Regression watchpoints:
audio resume positions, partial download cleanup, cached audio playback URLs.

## Lower-Risk Notes

### [ ] Note - Electron baseline can exceed a Chrome tab even before app-level issues

Type: Note
Priority: Context
Area: Product expectation
Files: `src/main/index.ts:69-123`, `src/renderer/App.tsx`, `src/renderer/content-app.tsx`
Concern:
Electron carries Chromium plus app code plus Node/Electron process overhead. It will usually not match a lightweight Chrome tab.
Why it matters:
This explains some baseline gap, but it does not explain the growth caused by hidden mounted views, editor retention, AI chat retention, and local-model residency.

### [ ] Note - Language-pack archives are streamed to disk, not fully buffered in JS memory

Type: Note
Priority: Context
Area: Main process install path
Files: `src/main/services/language-pack.service.ts:163-205`, `src/main/services/language-pack.service.ts:321-418`, `src/main/lib/resumable-download.ts:147-258`
Concern:
Language-pack download and extraction already use the safer disk-backed path. Downloads go to a file, zip extraction uses `yauzl` entry streams, and temporary archives are deleted after install.
Why it matters:
The memory issue around language packs is not "the zip is loaded into RAM". The real issue is the eager opening and retention of installed Tantivy indexes after startup or install.

### [ ] Note - Preload event subscriptions are cleanup-capable, but only if components unmount

Type: Note
Priority: Context
Area: Preload bridge
Files: `src/preload/index.ts:59-69`
Concern:
The preload bridge correctly returns unsubscribe functions for push events. The bigger problem is that some renderer components do not unmount, so those cleanups never run.

### [ ] Note - Sherpa TTS does not preload all installed models into RAM

Type: Note
Priority: Context
Area: Main process TTS model loading
Files: `src/main/services/tts/sherpa.provider.ts:237-250`, `src/main/services/tts/sherpa.provider.ts:379-422`, `src/main/services/tts/sherpa.worker.ts:20-22`, `src/main/services/tts/sherpa.worker.ts:162-176`, `src/main/services/tts/sherpa.worker.ts:245-275`
Concern:
Sherpa discovers installed models from disk, but the worker keeps only one active `ttsInstance` at a time and frees the previous instance when switching models.
Why it matters:
The TTS memory risks are active model residency, queued audio payloads, and base64 IPC duplication. The code does not appear to preload every installed Sherpa model into memory.

## Recommended Fix Order

### Phase 1 - biggest memory wins with lowest feature risk

1. Unmount inactive option views.
2. Prune AI chat renderer state and fix reasoning cleanup on delete/clear.
3. Add profiling checkpoints and before/after memory numbers.

### Phase 2 - structural renderer improvements

1. Virtualize AI chat messages.
2. Virtualize sermon/Bible paragraph lists.
3. Move document anchor scanning out of render.
4. Replace renderer content caches with smaller or size-aware policies.

### Phase 3 - main-process memory budgeting

1. Make local AI model disposal more aggressive or configurable.
2. Load Tantivy indexes lazily.
3. Rework TTS playback transport away from large base64 IPC payloads.
4. Revisit Bible DB mmap/cache sizing only after measurement.

## Suggested Verification Checklist For Each Fix

### [ ] Pending - Startup baseline

Measure Electron main RSS, renderer RSS, and JS heap after startup only.

### [ ] Pending - Notes path

Open Notes, type, leave Notes, and confirm memory drops after GC or at least stops climbing.

### [ ] Pending - AI chat path

Open AI chat, load several conversations, delete one, clear all, and confirm retained renderer memory falls.

### [ ] Pending - Document path

Open a long sermon, use search, enable TTS, switch tabs, and confirm no broken navigation/highlighting.

### [ ] Pending - Main-process path

Use local AI, TTS, search, and Bible features in one session, then idle the app and check whether main-process RSS settles back down.
