import type { BrowserWindow } from 'electron';
import type { LanguageModel } from 'ai';
import type { ChatTimeouts } from '../model-timeouts';

export interface AgentContext {
    model: LanguageModel;
    contentLanguage: string;
    uiLanguage: string;
    /** Active Bible version abbreviation (e.g. "lsg", "kjv") so agents use the user's selected version. */
    activeBibleVersion?: string;
    contextWindow?: number;
    maxOutputTokens?: number;
    /** Defaults to the remote-provider timeouts. */
    timeouts?: ChatTimeouts;
    /** Off for providers where a reasoning setting changes the wire format (see generation-environment). */
    reasoningControl?: boolean;
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
