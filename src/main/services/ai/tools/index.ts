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
    uiLanguage?: string;
    activeBibleVersion?: string;
    abortSignal?: AbortSignal;
    /** Required for subagent progress dispatch to the renderer. */
    browserWindow?: BrowserWindow;
    conversationId?: string;
    assistantMessageId?: string;
}

export function buildToolExecutors(
    defaultContentLanguage: string,
    defaultBibleAbbreviation?: string,
) {
    return {
        ...buildLanguageTools(),
        ...buildDocumentTools(),
        ...buildBibleTools(defaultContentLanguage, defaultBibleAbbreviation),
        ...buildSermonTools(defaultContentLanguage),
        ...buildSubjectTools(defaultContentLanguage),
        ...buildNoteTools(defaultContentLanguage),
    };
}

export function buildAiTools(defaultContentLanguage: string, options?: BuildAiToolsOptions) {
    const executors = buildToolExecutors(defaultContentLanguage, options?.activeBibleVersion);

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
                  contentLanguage: defaultContentLanguage,
                  uiLanguage: options.uiLanguage ?? defaultContentLanguage,
                  activeBibleVersion: options.activeBibleVersion,
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
