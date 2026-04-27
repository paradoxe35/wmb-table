import type { BrowserWindow } from 'electron';
import type { LanguageModel } from 'ai';

export interface AgentContext {
    model: LanguageModel;
    contentLanguage: string;
    uiLanguage: string;
    /** Active Bible version abbreviation (e.g. "lsg", "kjv") so agents use the user's selected version. */
    activeBibleVersion?: string;
    maxOutputTokens?: number;
    abortSignal?: AbortSignal;
    /** When provided, subagent tool progress is dispatched to the renderer. */
    dispatch?: AgentDispatch;
}

export interface AgentDispatch {
    browserWindow: BrowserWindow;
    conversationId: string;
    generationId: string;
    assistantMessageId: string;
}
