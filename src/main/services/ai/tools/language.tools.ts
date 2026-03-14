import { z } from 'zod';
import * as referenceRepo from '@main/database/repositories/reference.repository';
import * as tantivyService from '@main/services/tantivy.service';
import type { AiToolDefinition } from './types';

export function buildLanguageTools(): Record<string, AiToolDefinition> {
    return {
        getLanguages: {
            description: 'Get the installed languages available in the application.',
            inputSchema: z.object({}),
            execute: async () => {
                const installed = tantivyService.getInstalledLanguages();
                return referenceRepo
                    .getAllLanguages()
                    .filter((language) => {
                        return installed.includes(language.code);
                    })
                    .map((language) => {
                        return {
                            code: language.code,
                            title: language.title,
                            nativeTitle: language.nativeTitle,
                        };
                    });
            },
        },
    };
}
