import type { BrowserWindow } from 'electron';
import type { LanguageModel, ToolSet } from 'ai';
import type { AiRunOutcome } from '@shared/ai.types';
import type { PromptHistoryMessage } from '../context-memory';
import type { ChatTimeouts } from '../model-timeouts';
import type { RunBudget } from '../token-budget';
import type { RunDispatchGuard } from './stream-dispatcher';

export interface GenerationContext {
    browserWindow: BrowserWindow;
    conversationId: string;
    generationId: string;
    assistantMessageId: string;
    model: LanguageModel;
    systemPrompt: string;
    history: PromptHistoryMessage[];
    tools: ToolSet;
    abortSignal: AbortSignal;
    isCurrentRun: RunDispatchGuard;
    dispatchTextDelta: (delta: string) => void;
    budget: RunBudget;
    /** System prompt plus tool definitions, counted once per step on top of the messages. */
    fixedPromptTokens: number;
    /** Off for providers where a reasoning setting changes the wire format (see generation-environment). */
    reasoningControl: boolean;
    timeouts: ChatTimeouts;
    maxSteps?: number;
}

export interface GenerationRunner {
    run(context: GenerationContext): Promise<AiRunOutcome>;
}
