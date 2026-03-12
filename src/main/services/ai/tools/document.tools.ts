import { z } from 'zod';
import * as customDocsRepo from '@main/database/repositories/custom-documents.repository';
import type { AiToolDefinition } from './types';

export function buildDocumentTools(): Record<string, AiToolDefinition> {
    return {
        getCustomDocuments: {
            description: 'List user custom documents.',
            inputSchema: z.object({}),
            execute: async () => {
                return customDocsRepo.getCustomDocuments();
            },
        },
        getCustomDocumentContent: {
            description: 'Retrieve the content of a custom document by id.',
            inputSchema: z.object({ documentId: z.string() }),
            execute: async ({ documentId }) => {
                return customDocsRepo.getCustomDocumentContent(documentId);
            },
        },
    };
}
