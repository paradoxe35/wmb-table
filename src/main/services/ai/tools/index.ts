import { tool } from 'ai';
import type { LanguageModel, ToolSet } from 'ai';
import type { BrowserWindow } from 'electron';
import { buildBibleTools } from './bible.tools';
import { buildDocumentTools } from './document.tools';
import { buildLanguageTools } from './language.tools';
import { buildNoteTools } from './note.tools';
import { buildSermonTools } from './sermon.tools';
import { buildSubjectTools } from './subject.tools';
import { buildAgentTools } from '../agents';
import type { ChatTimeouts } from '../model-timeouts';

export interface BuildAiToolsOptions {
    model?: LanguageModel;
    uiLanguage?: string;
    activeBibleVersion?: string;
    contextWindow?: number;
    maxOutputTokens?: number;
    timeouts?: ChatTimeouts;
    reasoningControl?: boolean;
    abortSignal?: AbortSignal;
    /** Required for subagent progress dispatch to the renderer. */
    browserWindow?: BrowserWindow;
    conversationId?: string;
    generationId?: string;
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
        ...buildNoteTools(),
    };
}

export function buildAiTools(
    defaultContentLanguage: string,
    options?: BuildAiToolsOptions,
): ToolSet {
    const executors = buildToolExecutors(defaultContentLanguage, options?.activeBibleVersion);

    const dispatch =
        options?.browserWindow &&
        options.conversationId &&
        options.generationId &&
        options.assistantMessageId
            ? {
                  browserWindow: options.browserWindow,
                  conversationId: options.conversationId,
                  generationId: options.generationId,
                  assistantMessageId: options.assistantMessageId,
              }
            : undefined;

    const agentExecutors = options?.model
        ? buildAgentTools({
              model: options.model,
              contentLanguage: defaultContentLanguage,
              uiLanguage: options.uiLanguage ?? defaultContentLanguage,
              activeBibleVersion: options.activeBibleVersion,
              contextWindow: options.contextWindow,
              maxOutputTokens: options.maxOutputTokens,
              timeouts: options.timeouts,
              reasoningControl: options.reasoningControl,
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
