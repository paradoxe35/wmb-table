import { z } from 'zod';
import type { McpConfigureClientRequest, McpServerSettingsPatch } from '@shared/mcp.types';

export const mcpSettingsPatchSchema: z.ZodType<McpServerSettingsPatch> = z.strictObject({
    enabled: z.boolean().optional(),
    allowWrites: z.boolean().optional(),
});

export const mcpConfigureClientSchema: z.ZodType<McpConfigureClientRequest> = z.strictObject({
    clientId: z.literal('claude-desktop'),
});
