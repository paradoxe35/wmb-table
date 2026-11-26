import type { ToolSet } from 'ai';
import { buildSystemPrompt } from './system-prompt';
import { buildConversationContext, type PromptHistoryMessage } from './context-memory';
import {
    buildContextReminder,
    shouldInjectContextReminder,
    withContextReminder,
} from './context-reminder';
import {
    measurePromptTokens,
    measureToolTokens,
    planRunBudget,
    type RunBudget,
} from './token-budget';
import type { GenerationEnvironment } from './generation-environment';

export interface GenerationPrompt {
    systemPrompt: string;
    history: PromptHistoryMessage[];
    budget: RunBudget;
    fixedPromptTokens: number;
    /** For the start-of-run log line only. */
    stats: {
        historyTokenCount: number;
        promptTokens: number;
        toolTokens: number;
        contextReminder: boolean;
    };
}

/** One budget for the whole run: the history budget and every step's output cap come from it. */
export function buildGenerationPrompt(
    conversationId: string,
    environment: GenerationEnvironment,
    tools: ToolSet,
): GenerationPrompt {
    const system = buildSystemPrompt({
        contentLanguageCode: environment.contentLanguageCode,
        uiLanguageCode: environment.uiLanguageCode,
        installedLanguages: environment.installedLanguages,
        languagePreference: environment.settings.languagePreference,
        activeBibleVersion: environment.activeBibleVersion,
    });
    const toolTokens = measureToolTokens(tools);
    // Reserved even when not injected, so it can never push the request over.
    const reminder = buildContextReminder();
    const budget = planRunBudget(
        environment.modelLimits,
        measurePromptTokens(system) + measurePromptTokens(reminder) + toolTokens,
    );

    const { recentMessages, historyTokenCount, recentTokenCount, summary } =
        buildConversationContext(conversationId, budget.historyBudget);
    const systemPrompt = summary ? `${system}\n\nConversation memory:\n${summary}` : system;
    const fixedPromptTokens = measurePromptTokens(systemPrompt) + toolTokens;
    const promptTokens = fixedPromptTokens + recentTokenCount;
    const contextReminder = shouldInjectContextReminder({
        compacted: summary != null,
        promptTokens,
        contextWindow: environment.modelLimits.contextWindow,
    });

    return {
        systemPrompt,
        history: contextReminder ? withContextReminder(recentMessages, reminder) : recentMessages,
        budget,
        fixedPromptTokens,
        stats: { historyTokenCount, promptTokens, toolTokens, contextReminder },
    };
}
