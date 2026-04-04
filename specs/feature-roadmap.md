# Feature Roadmap

This document groups proposed product features by impact for the current Wmb Table architecture.

Impact here means expected user value multiplied by architectural fit:

- High impact: immediately improves core study workflows and fits the current codebase well.
- Medium impact: strong value, but needs broader UI work or more coordination across modules.
- Foundational impact: useful and strategic, but either less frequently used or dependent on prior work.

## Current Product Shape

The app already provides:

- sermon library browsing and full-text search
- Bible browsing and version switching
- document reading with persistent tabs and reading positions
- notes, highlights, and subjects
- AI chat with domain tools
- TTS/audio playback
- custom PDF document import
- Google Drive backup and sync

The features below are designed to extend those workflows rather than replace them.

## High Impact

### 1. Unified Cross-Library Search

#### Problem

Search is currently split by domain. Users can search sermons and Bible content, but cannot run one query across sermons, notes, highlights, subjects, and imported documents from a single entry point.

#### Outcome

Users can run one search and quickly pivot across all their study material.

#### Scope

- Add a global search mode that queries:
    - sermon title and metadata
    - sermon content
    - Bible verses
    - notes
    - highlights
    - subjects
    - custom documents
- Group results by source with counts.
- Add filters for source type, language, date, and exact/all/any match mode where applicable.
- Keep deep links into the correct document, paragraph, verse, note, or subject item.
- Support pagination and empty states.

#### User Stories

- As a reader, I want one search box for everything I have studied.
- As a note-taker, I want to find where a phrase appears in my notes and in sermons at the same time.
- As a researcher, I want to narrow results by source type without rewriting the query.

#### Implementation Areas

- Main:
    - `src/main/ipc/search.ipc.ts`
    - `src/main/services/search.service.ts`
    - `src/main/database/repositories/*.repository.ts`
- Renderer:
    - `src/renderer/views/options/search/*`
    - `src/renderer/stores/search.store.ts`
    - document-opening hooks for cross-source navigation

#### Acceptance Criteria

- One query can return mixed results from all configured sources.
- Clicking any result opens the correct destination and scroll target.
- Search remains responsive on large datasets.

### 2. AI Actions From Selected Text

#### Problem

The app already has AI chat and domain tools, but selected content inside documents is not yet a first-class AI entry point.

#### Outcome

Users can act on a selected paragraph or verse without leaving the reading flow.

#### Scope

- Add context-menu and selection actions for:
    - summarize
    - explain
    - translate
    - generate study note
    - add to subject
    - compare with Bible passages
    - ask assistant about this passage
- Pass structured context to AI:
    - document identity
    - paragraph or verse range
    - visible document title
    - language
- Allow direct output targets:
    - new note
    - existing note
    - new subject
    - existing subject
    - chat conversation

#### User Stories

- As a reader, I want to select a paragraph and ask the assistant to explain it in context.
- As a teacher, I want to convert selected text into a note or subject item in one step.
- As a multilingual user, I want to translate the current passage without copying text manually.

#### Implementation Areas

- Main:
    - `src/main/services/ai/*`
    - `src/main/services/ai/tools/*`
    - `src/main/ipc/ai.ipc.ts`
- Renderer:
    - document context-menu hooks in `src/renderer/views/document-view/hooks/*`
    - `src/renderer/views/options/ai-chat/*`
    - notes and subjects integration flows

#### Acceptance Criteria

- Selected text can be sent to AI from sermon, Bible, and custom-document views.
- AI results can be inserted into notes or subjects without manual copy/paste.
- Errors and provider limitations are surfaced clearly.

### 3. Saved Study Workspaces

#### Problem

Users can restore tabs and reading positions, but not a complete study session that includes related tools and context.

#### Outcome

Users can save and reopen named study sessions.

#### Scope

- Save a workspace containing:
    - open tabs
    - active tab
    - reading positions
    - search query and filters
    - active subject
    - active note
    - active AI conversation
    - reading mode and zoom state
- Add create, rename, delete, duplicate, and restore actions.
- Support auto-save of the current unnamed session.

#### User Stories

- As a researcher, I want to reopen a full sermon-study session exactly where I left it.
- As a pastor, I want separate workspaces for sermon prep, Bible study, and language review.

#### Implementation Areas

- Main:
    - new repository and schema for workspaces
    - IPC endpoints for CRUD and restore
- Renderer:
    - tab store
    - app store
    - search store
    - note, subject, and AI chat stores
    - settings or top-level workspace switcher UI

#### Acceptance Criteria

- Restoring a workspace recreates the previous working state with minimal drift.
- Workspace restore is resilient when referenced content is missing or changed.

## Medium Impact

### 4. Side-by-Side Comparison Mode

#### Problem

The app supports many document types, but comparison workflows still require switching tabs mentally rather than viewing content in parallel.

#### Outcome

Users can compare two documents or two versions in a dedicated split-view mode.

#### Scope

- Add split-view layout with independently scrollable panes.
- Support combinations:
    - sermon vs sermon
    - sermon vs Bible
    - Bible vs Bible
    - sermon vs custom document
- Add optional synchronized navigation by paragraph or verse.
- Allow “open current in comparison” from search, tabs, and context menus.

#### User Stories

- As a translator, I want to compare two sermon translations side by side.
- As a Bible student, I want to compare two Bible versions in the same chapter.
- As a researcher, I want to compare an imported PDF source against a sermon passage.

#### Implementation Areas

- Renderer-heavy:
    - `src/renderer/views/document-view/*`
    - tab management
    - search highlight and pending navigation hooks
- Main:
    - minimal new IPC unless comparison state is persisted

#### Acceptance Criteria

- Two panes can display distinct document identities at the same time.
- Each pane preserves its own navigation, highlights, and search state.

### 5. Improved Document Import Pipeline

#### Problem

Custom documents are currently limited to PDF upload with text extraction heuristics.

#### Outcome

Users can build a richer personal study library with better import fidelity.

#### Scope

- Add support for:
    - `txt`
    - `md`
    - `docx`
    - `epub`
- Preserve document metadata where available.
- Improve PDF handling:
    - better paragraph reconstruction
    - title detection
    - language detection suggestion
    - scanned PDF fallback via OCR-ready pipeline
- Add import preview before save.
- Allow document reprocessing after import.

#### User Stories

- As a user, I want to import common text formats without converting them to PDF first.
- As a researcher, I want to preview extracted content before saving a broken import.

#### Implementation Areas

- Main:
    - `src/main/ipc/app.ipc.ts`
    - `src/main/services/pdf-extract.service.ts`
    - new import services per format
    - custom document repository
- Renderer:
    - `src/renderer/views/components/modals/custom-documents.tsx`
    - custom document reading flow

#### Acceptance Criteria

- Supported formats import successfully with consistent paragraph storage.
- Users can detect and reject bad extraction before saving.

### 6. Backlinks and Study Graph

#### Problem

References exist across notes, highlights, subjects, sermons, and Bible passages, but users cannot see the relationship graph around a passage.

#### Outcome

Every passage becomes a hub that shows related notes, subjects, highlights, and linked documents.

#### Scope

- Add backlinks panel for the current paragraph or verse.
- Show:
    - notes referencing this passage
    - subject items built from this passage
    - highlights on this passage
    - AI-generated outputs linked to this passage
- Add lightweight graph navigation:
    - “show related”
    - “open all related in workspace”

#### User Stories

- As a student, I want to know everything I have already written about a paragraph.
- As a teacher, I want to revisit all linked material from one reference point.

#### Implementation Areas

- Main:
    - repository queries across notes, highlights, and subjects
- Renderer:
    - document-side related-items panel
    - navigation into note, subject, and highlight detail

#### Acceptance Criteria

- From a paragraph or verse, users can discover all related personal study artifacts.
- Related items open in the correct context.

### 7. Sync Conflict and Restore UI

#### Problem

Backup exists, but trust is limited when users cannot inspect sync history, restore points, or conflicts.

#### Outcome

Sync becomes understandable and recoverable.

#### Scope

- Add sync status detail panel:
    - last successful sync
    - pending changes
    - failed changes
    - account status
- Add restore options:
    - restore latest backup
    - preview restore summary
    - confirm destructive merge behavior
- Add conflict presentation for user-owned data:
    - note conflicts
    - subject conflicts
    - custom document conflicts

#### User Stories

- As a user, I want to know whether my study data is safely backed up.
- As a user on two devices, I want conflicts explained before my data changes.

#### Implementation Areas

- Main:
    - `src/main/services/sync/*`
    - `src/main/ipc/backup.ipc.ts`
    - sync repositories
- Renderer:
    - `src/renderer/views/options/settings/backup-tab.tsx`
    - sync listener and status UI

#### Acceptance Criteria

- Users can inspect backup state without reading logs.
- Restore and conflict flows are explicit and reversible where possible.

## Foundational Impact

### 8. Advanced Audio Study Mode

#### Problem

TTS is already strong, but audio is still mostly single-document playback rather than a study workflow.

#### Outcome

Users can use the app as a long-form listening and review tool.

#### Scope

- Add queue support across sermons, Bible chapters, and custom documents.
- Add bookmarks for playback positions and named markers.
- Add sentence- or paragraph-follow mode.
- Add resume-last-listening-session.
- Add optional audio export for generated TTS where provider terms allow it.

#### User Stories

- As a commuter, I want to queue study material and continue listening later.
- As a listener, I want the app to keep my place across sessions.
- As a reviewer, I want bookmarks at important moments in audio playback.

#### Implementation Areas

- Main:
    - `src/main/services/tts/*`
    - audio cache and repository layers
- Renderer:
    - mini player
    - document TTS controls
    - audio store and keyboard shortcuts

#### Acceptance Criteria

- Users can queue, resume, and bookmark long-form playback.
- Audio progress stays in sync with document position when enabled.

## Suggested Delivery Order

1. Unified Cross-Library Search
2. AI Actions From Selected Text
3. Saved Study Workspaces
4. Improved Document Import Pipeline
5. Side-by-Side Comparison Mode
6. Sync Conflict and Restore UI
7. Backlinks and Study Graph
8. Advanced Audio Study Mode

## Notes For Planning

- Features `1`, `2`, and `3` are the best near-term bets because they deepen the app's core identity as a study workspace.
- Features `4`, `5`, and `6` make the workspace more powerful once search and state management are stronger.
- Features `7` and `8` improve trust and long-session usability, but are less central than discovery and knowledge-capture flows.
