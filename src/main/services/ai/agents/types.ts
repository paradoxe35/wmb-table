import type { LanguageModel } from 'ai';

export interface AgentContext {
    model: LanguageModel;
    languageCode: string;
    abortSignal?: AbortSignal;
}
