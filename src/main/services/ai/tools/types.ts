import type { z } from 'zod';

export interface AiToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
    description: string;
    inputSchema: TSchema;
    execute: (input: any) => Promise<unknown> | unknown;
}
