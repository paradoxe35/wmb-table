import { generateId } from '@ai-sdk/provider-utils';
import type { JSONSchema7 } from '@ai-sdk/provider';
import { z } from 'zod';
import type { LanguageModelV3FunctionTool, LanguageModelV3ToolChoice } from '@ai-sdk/provider';
import type { ChatSessionModelFunctions } from 'node-llama-cpp';
import type { AiToolResult } from '@shared/ai.types';
import type { AiToolDefinition } from '../tools/types';

type ToolExecutors = Record<string, AiToolDefinition>;

function normalizeToolInput(input: unknown): Record<string, unknown> {
    return input && typeof input === 'object' && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
}

export function filterToolExecutors(
    executors: ToolExecutors,
    tools: LanguageModelV3FunctionTool[] | undefined,
    toolChoice: LanguageModelV3ToolChoice | undefined,
): ToolExecutors {
    if (!tools || tools.length === 0 || toolChoice?.type === 'none') {
        return {};
    }

    const allowedNames = new Set(
        tools.map((tool) => {
            return tool.name;
        }),
    );
    if (toolChoice?.type === 'tool') {
        allowedNames.clear();
        allowedNames.add(toolChoice.toolName);
    }

    return Object.fromEntries(
        Object.entries(executors).filter(([name]) => {
            return allowedNames.has(name);
        }),
    );
}

export function buildLocalChatFunctions(input: {
    executors: ToolExecutors;
    onToolCall?: (toolCall: { id: string; name: string; input: Record<string, unknown> }) => void;
    onToolResult?: (toolResult: AiToolResult) => void;
}): ChatSessionModelFunctions {
    return Object.fromEntries(
        Object.entries(input.executors).map(([name, definition]) => {
            return [
                name,
                {
                    description: definition.description,
                    params: z.toJSONSchema(definition.inputSchema) as JSONSchema7,
                    handler: async (params: Record<string, unknown>) => {
                        const toolCallId = generateId();
                        const parsed = await definition.inputSchema.safeParseAsync(params);
                        const validatedInput = parsed.success
                            ? normalizeToolInput(parsed.data)
                            : normalizeToolInput(params);

                        input.onToolCall?.({ id: toolCallId, name, input: validatedInput });

                        if (!parsed.success) {
                            const issues = parsed.error.issues
                                .map((issue) => {
                                    const path =
                                        issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
                                    return `${path}${issue.message}`;
                                })
                                .join('; ');
                            const output = {
                                error: `Invalid input for tool "${name}". ${issues}`.trim(),
                            };
                            input.onToolResult?.({ toolCallId, name, output, isError: true });
                            return output;
                        }

                        const output = await definition.execute(validatedInput);
                        input.onToolResult?.({ toolCallId, name, output });
                        return output;
                    },
                },
            ];
        }),
    ) as ChatSessionModelFunctions;
}
