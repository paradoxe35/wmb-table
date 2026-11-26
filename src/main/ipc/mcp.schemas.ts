import { z } from 'zod';
import type { McpServerSettingsPatch } from '@shared/mcp.types';

export const mcpSettingsPatchSchema: z.ZodType<McpServerSettingsPatch> = z.strictObject({
    enabled: z.boolean().optional(),
    allowWrites: z.boolean().optional(),
});
