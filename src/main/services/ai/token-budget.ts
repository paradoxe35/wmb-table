import { asSchema } from 'ai';
import { estimateTokenCount } from 'tokenx';

const SYSTEM_PROMPT_TOKEN_ESTIMATE = 2_000;
const BUDGET_SAFETY_MARGIN = 512;
export const TOOL_DEFINITIONS_TOKEN_ESTIMATE = 5_000;

export const DEFAULT_REMOTE_TOKEN_BUDGET = 32_000;
export const MIN_HISTORY_BUDGET = 4_000;
export const MAX_HISTORY_BUDGET = 200_000;

export const REMOTE_MAX_OUTPUT_TOKENS = 6_144;
export const REMOTE_MIN_OUTPUT_TOKENS = 2_048;
export const MIN_REMOTE_CONTEXT_WINDOW = 16_000;

function computeOverhead(toolTokens: number): number {
    return SYSTEM_PROMPT_TOKEN_ESTIMATE + toolTokens + BUDGET_SAFETY_MARGIN;
}

export function resolveRemoteOutputTokens(contextWindow?: number, toolTokens?: number): number {
    if (!contextWindow) return REMOTE_MAX_OUTPUT_TOKENS;

    const overhead = computeOverhead(toolTokens ?? TOOL_DEFINITIONS_TOKEN_ESTIMATE);
    const available = contextWindow - overhead - MIN_HISTORY_BUDGET;
    if (available >= REMOTE_MAX_OUTPUT_TOKENS) return REMOTE_MAX_OUTPUT_TOKENS;

    return Math.max(REMOTE_MIN_OUTPUT_TOKENS, available);
}

export function calculateRemoteTokenBudget(contextWindow?: number, toolTokens?: number): number {
    if (!contextWindow) {
        return DEFAULT_REMOTE_TOKEN_BUDGET;
    }

    const tokens = toolTokens ?? TOOL_DEFINITIONS_TOKEN_ESTIMATE;
    const overhead = computeOverhead(tokens);
    const outputReserve = resolveRemoteOutputTokens(contextWindow, tokens);
    const budget = contextWindow - overhead - outputReserve;

    return Math.max(MIN_HISTORY_BUDGET, Math.min(budget, MAX_HISTORY_BUDGET));
}

export function measureToolTokens(tools: Record<string, unknown>): number {
    const text = Object.entries(tools)
        .map(([name, t]) => {
            const tool = (t as Record<string, unknown>) ?? {};
            const schema = resolveToolSchema(tool.inputSchema ?? tool.parameters);
            const description = typeof tool.description === 'string' ? tool.description : '';
            return `${name}:${description}:${JSON.stringify(schema)}`;
        })
        .join('\n');

    return estimateTokenCount(text);
}

function resolveToolSchema(schema: unknown): unknown {
    if (schema == null) {
        return {};
    }

    try {
        const normalized = asSchema(schema as never).jsonSchema;
        if (
            normalized &&
            typeof normalized === 'object' &&
            typeof (normalized as { then?: unknown }).then !== 'function'
        ) {
            return normalized;
        }
    } catch {
        return schema;
    }

    return schema;
}
