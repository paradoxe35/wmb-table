import type { BrowserWindow } from 'electron';
import type { LanguageModel } from 'ai';
import type { buildAiTools } from '../tools';
import type { PromptHistoryMessage } from '../context-memory';

export interface GenerationContext {
    browserWindow: BrowserWindow;
    conversationId: string;
    assistantMessageId: string;
    model: LanguageModel;
    systemPrompt: string;
    history: PromptHistoryMessage[];
    tools: ReturnType<typeof buildAiTools>;
    abortSignal: AbortSignal;
}

export interface GenerationRunner {
    run(context: GenerationContext): Promise<void>;
}
