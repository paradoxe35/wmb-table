import type { PromptHistoryMessage } from './context-memory';

/**
 * Counters instruction fade in long conversations: the system prompt loses weight as history
 * grows, so tool calls and formatting get dropped well before the window is full. Rebuilt per
 * request and never stored, so it cannot accumulate across turns.
 */

const CONTEXT_USAGE_RATIO = 0.5;
const HISTORY_TOKENS = 20_000;

export interface ContextReminderInput {
    compacted: boolean;
    promptTokens: number;
    contextWindow?: number;
}

export function shouldInjectContextReminder(input: ContextReminderInput): boolean {
    if (input.compacted || input.promptTokens >= HISTORY_TOKENS) {
        return true;
    }

    return (
        input.contextWindow != null &&
        input.promptTokens >= input.contextWindow * CONTEXT_USAGE_RATIO
    );
}

export function buildContextReminder(): string {
    return [
        '<system-reminder>',
        'Automated reminder from the application, not a message from the user. Never mention it, quote it, or reply to it.',
        'The instructions given at the start of this conversation still apply in full. Re-anchor on them:',
        '- Call tools for anything that depends on application data. Older tool results in this conversation are condensed summaries, not verified sources.',
        '- Never cite a sermon paragraph or a Bible verse unless a tool returned it in this run. Search or read again to recover exact fields.',
        '- Keep sermon, Bible, and document citations as clickable `wmb://` markdown links built from exact tool fields.',
        '- Use researchTopic for broad sermon research and readSermon for one specific sermon, instead of answering from memory.',
        '- Write the reply as well-formed markdown: real paragraph breaks, headings and lists where they help, and normal spacing between words.',
        '- Report what the prophet and the Bible say. Never give your own interpretation of spiritual matters.',
        '</system-reminder>',
    ].join('\n');
}

export function withContextReminder(
    history: PromptHistoryMessage[],
    reminder: string,
): PromptHistoryMessage[] {
    for (let index = history.length - 1; index >= 0; index--) {
        if (history[index].role === 'user') {
            const next = [...history];
            next[index] = {
                ...next[index],
                content: `${next[index].content}\n\n${reminder}`,
            };
            return next;
        }
    }

    return [...history, { role: 'user', content: reminder }];
}
