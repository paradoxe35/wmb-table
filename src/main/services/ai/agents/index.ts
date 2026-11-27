import type { AiToolDefinition } from '../tools/types';
import type { AgentContext } from './types';
import { buildResearchAgentTool } from './research-agent';
import { createSubAgentRunner } from './run-sub-agent';
import { buildSermonReaderAgentTool } from './sermon-reader-agent';

export type { AgentContext } from './types';

export function buildAgentTools(ctx: AgentContext): Record<string, AiToolDefinition> {
    const runSubAgent = createSubAgentRunner(ctx);
    return {
        ...buildResearchAgentTool(ctx, runSubAgent),
        ...buildSermonReaderAgentTool(ctx, runSubAgent),
    };
}
