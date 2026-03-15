import { tool } from 'ai';
import type { LanguageModel } from 'ai';
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

    const agentExecutors =
        options?.model && !options.isLocal
            ? buildAgentTools({
                  model: options.model,
                  languageCode: defaultLanguageCode,
                  abortSignal: options.abortSignal,
              })
            : {};

    const allExecutors = { ...executors, ...agentExecutors };

    return Object.fromEntries(
        Object.entries(allExecutors).map(([name, definition]) => {
            return [name, tool(definition)];
        }),
    );
}
