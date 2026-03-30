import { generateText, type LanguageModel } from 'ai';
import log from '@main/lib/logger';

const TITLE_PROMPT =
    'Generate a short conversation title (max 8 words) that captures the main topic. ' +
    'Reply with ONLY the title, no quotes, no punctuation at the end.';

/**
 * Title generation triggers once after the second complete exchange
 * to capture the real intent. Skipped if an AI title was already generated.
 */
const TITLE_TRIGGER_MESSAGE_COUNT = 4;

export function shouldGenerateTitle(messageCount: number, aiTitle: boolean): boolean {
    return messageCount >= TITLE_TRIGGER_MESSAGE_COUNT && !aiTitle;
}

/**
 * Generates a concise conversation title using the AI model.
 * Returns null if generation fails (caller should keep the existing title).
 */
export async function generateConversationTitle(
    model: LanguageModel,
    uiLanguage: string,
    contentLanguage: string,
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
                `Write the title in "${uiLanguage}".`,
                `The sermon content language is "${contentLanguage}".`,
                `Conversation:\n${conversationSnippet}`,
            ].join('\n'),
            maxOutputTokens: 4096,
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
