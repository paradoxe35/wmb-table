import { z } from 'zod';
import * as customDocsRepo from '@main/database/repositories/custom-documents.repository';
import type { AiToolDefinition } from './types';

export function buildDocumentTools(): Record<string, AiToolDefinition> {
    return {
        getCustomDocuments: {
            description: 'List user-imported custom documents (PDF, text files, etc.).',
            inputSchema: z.object({}),
            execute: async () => {
                const docs = customDocsRepo.getCustomDocuments();
                if (docs.length === 0) return { error: 'No custom documents found.' };
                return docs.map((d) => ({ documentId: d.id, title: d.title }));
            },
        },
        getCustomDocumentContent: {
            description:
                'Retrieve the text content of a custom document by its id. ' +
                'Supports pagination via startLine and maxLines to avoid loading the entire document at once.',
            inputSchema: z.object({
                documentId: z.string(),
                startLine: z
                    .number()
                    .int()
                    .min(0)
                    .optional()
                    .describe('Line offset to start from (default 0)'),
                maxLines: z
                    .number()
                    .int()
                    .min(1)
                    .max(100)
                    .optional()
                    .describe('Maximum number of lines to return (default 50, max 100)'),
            }),
            execute: async ({ documentId: rawDocumentId, startLine = 0, maxLines = 50 }) => {
                const documentId = rawDocumentId.trim();
                const doc = await customDocsRepo.getCustomDocumentContent(documentId);
                if (!doc) return { error: `Document "${documentId}" not found.` };
                if (!doc.content) return { error: 'Document has no text content.' };

                const lines = doc.content.split('\n');
                const totalLines = lines.length;
                const slice = lines.slice(startLine, startLine + maxLines).join('\n');

                return {
                    ...doc,
                    content: slice,
                    totalLines,
                    startLine,
                    returnedLines: Math.max(0, Math.min(maxLines, totalLines - startLine)),
                };
            },
        },
    };
}
