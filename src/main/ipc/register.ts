import { registerDocumentsHandlers } from './documents.ipc';
import { registerSearchHandlers } from './search.ipc';
import { registerNotesHandlers } from './notes.ipc';
import { registerBibleHandlers } from './bible.ipc';
import { registerSubjectsHandlers } from './subjects.ipc';
import { registerAudioHandlers } from './audio.ipc';
import { registerBackupHandlers } from './backup.ipc';
import { registerAppHandlers } from './app.ipc';
import { registerLanguageHandlers } from './languages.ipc';
import { registerSyncHandlers } from './sync.ipc';
import { registerHighlightsHandlers } from './highlights.ipc';
import { registerTtsHandlers } from './tts.ipc';
import { registerAiHandlers } from './ai.ipc';
import { registerPowerHandlers } from './power.ipc';
import { registerMcpHandlers } from './mcp.ipc';

/**
 * Registers all domain IPC handlers. Call once before creating the window.
 */
export function initializeIpc(): void {
    registerDocumentsHandlers();
    registerSearchHandlers();
    registerNotesHandlers();
    registerBibleHandlers();
    registerSubjectsHandlers();
    registerAudioHandlers();
    registerBackupHandlers();
    registerAppHandlers();
    registerLanguageHandlers();
    registerSyncHandlers();
    registerHighlightsHandlers();
    registerTtsHandlers();
    registerAiHandlers();
    registerPowerHandlers();
    registerMcpHandlers();
}
