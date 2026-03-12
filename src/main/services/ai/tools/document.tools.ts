import { z } from 'zod';
import * as customDocsRepo from '@main/database/repositories/custom-documents.repository';
import type { AiToolDefinition } from './types';

export function buildDocumentTools(): Record<string, AiToolDefinition> {
    return {
        getCustomDocuments: {
            description: 'List user-imported custom documents (PDF, text files, etc.).',
            inputSchema: z.object({}),
            execute: async () => {
                return customDocsRepo.getCustomDocuments();
            },
        },
        getCustomDocumentContent: {
            description: 'Retrieve the full text content of a custom document by its id.',
            inputSchema: z.object({ documentId: z.string() }),
            execute: async ({ documentId }) => {
                return customDocsRepo.getCustomDocumentContent(documentId);
            },
        },
    };
}
