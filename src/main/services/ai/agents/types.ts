import type { BrowserWindow } from 'electron';
import type { LanguageModel } from 'ai';

export interface AgentContext {
    model: LanguageModel;
    contentLanguage: string;
    abortSignal?: AbortSignal;
    /** When provided, subagent tool progress is dispatched to the renderer. */
    dispatch?: AgentDispatch;
}

export interface AgentDispatch {
    browserWindow: BrowserWindow;
    conversationId: string;
    assistantMessageId: string;
}
