import { tool } from 'ai';
import { buildBibleTools } from './bible.tools';
import { buildDocumentTools } from './document.tools';
import { buildLanguageTools } from './language.tools';
import { buildNoteTools } from './note.tools';
import { buildSermonTools } from './sermon.tools';
import { buildSubjectTools } from './subject.tools';

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

export function buildAiTools(defaultLanguageCode: string) {
    const executors = buildToolExecutors(defaultLanguageCode);
    return Object.fromEntries(
        Object.entries(executors).map(([name, definition]) => {
            return [name, tool(definition)];
        }),
    );
}
