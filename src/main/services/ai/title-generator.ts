import { generateText, type LanguageModel } from 'ai';
import log from '@main/lib/logger';

const TITLE_PROMPT =
    'Generate a short conversation title (max 8 words) that captures the main topic. ' +
    'Reply with ONLY the title, no quotes, no punctuation at the end. ' +
    'Use the same language as the conversation.';

/**
 * Title generation triggers after the second complete exchange
 * user message to capture the real intent.
 */
const TITLE_TRIGGER_MESSAGE_COUNT = 4;

export function shouldGenerateTitle(messageCount: number): boolean {
    return messageCount === TITLE_TRIGGER_MESSAGE_COUNT;
}

/**
 * Generates a concise conversation title using the AI model.
 * Returns null if generation fails (caller should keep the existing title).
 */
export async function generateConversationTitle(
    model: LanguageModel,
    languageCode: string,
    messages: { role: string; content: string }[],
    abortSignal?: AbortSignal,
): Promise<string | null> {
    try {
        const conversationSnippet = messages
            .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
            .join('\n');

        const { text } = await generateText({
            model,
            prompt: [
                TITLE_PROMPT,
                `The active application language is: ${languageCode}`,
                `Conversation:\n${conversationSnippet}`,
            ].join('\n'),
            maxOutputTokens: 30,
            abortSignal,
        });

        const title = text.trim().replace(/[."]+$/, '');
        return title.length >= 2 ? title.slice(0, 80) : null;
    } catch (error) {
        log.warn('AI title generation failed, keeping existing title', {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
