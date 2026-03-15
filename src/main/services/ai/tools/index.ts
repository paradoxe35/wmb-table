import { tool } from 'ai';
import type { LanguageModel } from 'ai';
import type { BrowserWindow } from 'electron';
import { buildBibleTools } from './bible.tools';
import { buildDocumentTools } from './document.tools';
import { buildLanguageTools } from './language.tools';
import { buildNoteTools } from './note.tools';
import { buildSermonTools } from './sermon.tools';
import { buildSubjectTools } from './subject.tools';
import { buildAgentTools } from '../agents';

export interface BuildAiToolsOptions {
    model?: LanguageModel;
    isLocal?: boolean;
    abortSignal?: AbortSignal;
    /** Required for subagent progress dispatch to the renderer. */
    browserWindow?: BrowserWindow;
    conversationId?: string;
    assistantMessageId?: string;
}

export function buildToolExecutors(defaultLanguageCode: string) {
    return {
        ...buildLanguageTools(),
        ...buildDocumentTools(),
        ...buildBibleTools(defaultLanguageCode),
        ...buildSermonTools(defaultLanguageCode),
        ...buildSubjectTools(defaultLanguageCode),
        ...buildNoteTools(defaultLanguageCode),
    };
}

export function buildAiTools(defaultLanguageCode: string, options?: BuildAiToolsOptions) {
    const executors = buildToolExecutors(defaultLanguageCode);

    const dispatch =
        options?.browserWindow && options.conversationId && options.assistantMessageId
            ? {
                  browserWindow: options.browserWindow,
                  conversationId: options.conversationId,
                  assistantMessageId: options.assistantMessageId,
              }
            : undefined;

    const agentExecutors =
        options?.model && !options.isLocal
            ? buildAgentTools({
                  model: options.model,
                  languageCode: defaultLanguageCode,
                  abortSignal: options.abortSignal,
                  dispatch,
              })
            : {};

    const allExecutors = { ...executors, ...agentExecutors };

    return Object.fromEntries(
        Object.entries(allExecutors).map(([name, definition]) => {
            return [name, tool(definition)];
        }),
    );
}
