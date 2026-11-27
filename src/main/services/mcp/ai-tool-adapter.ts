import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import type { AiToolDefinition } from '@main/services/ai/tools/types';
import { isWriteTool } from '@main/services/ai/tools/tool-access';
import log from '@main/lib/logger';

type ToolDefinitions = Record<string, AiToolDefinition>;

export function selectExposedTools(
    definitions: ToolDefinitions,
    allowWrites: boolean,
): ToolDefinitions {
    return Object.fromEntries(
        Object.entries(definitions).filter(([name]) => allowWrites || !isWriteTool(name)),
    );
}

/** Exposes the assistant's own tools as MCP tools, keeping their name, description and schema. */
export function registerAiTools(server: McpServer, definitions: ToolDefinitions): void {
    for (const [name, definition] of Object.entries(definitions)) {
        server.registerTool(
            name,
            {
                description: definition.description,
                inputSchema: definition.inputSchema,
                annotations: { readOnlyHint: !isWriteTool(name), openWorldHint: false },
            },
            (input: unknown) => runAiTool(name, definition, input),
        );
    }
}

export async function runAiTool(
    name: string,
    definition: AiToolDefinition,
    input: unknown,
): Promise<CallToolResult> {
    try {
        return toCallToolResult(await definition.execute(input));
    } catch (error) {
        log.warn(`[mcp] Tool ${name} failed:`, error);
        return errorResult(error instanceof Error ? error.message : String(error));
    }
}

/** The tools report expected failures as `{ error }` instead of throwing. */
function toCallToolResult(result: unknown): CallToolResult {
    const text = JSON.stringify(result ?? null);
    return hasToolError(result) ? errorResult(text) : { content: [{ type: 'text', text }] };
}

function hasToolError(result: unknown): boolean {
    return typeof result === 'object' && result !== null && 'error' in result && !!result.error;
}

function errorResult(text: string): CallToolResult {
    return { content: [{ type: 'text', text }], isError: true };
}
