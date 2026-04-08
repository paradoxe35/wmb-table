import { asSchema, FlexibleSchema, Tool } from 'ai';
import { estimateTokenCount } from 'tokenx';

const BUDGET_SAFETY_MARGIN = 512;

export const DEFAULT_REMOTE_TOKEN_BUDGET = 32_000;
export const MIN_HISTORY_BUDGET = 4_000;
export const MAX_HISTORY_BUDGET = 200_000;

export const REMOTE_MAX_OUTPUT_TOKENS = 6_144;
export const REMOTE_MIN_OUTPUT_TOKENS = 8_192;
export const MIN_REMOTE_CONTEXT_WINDOW = 16_000;

interface TokenOverheadInput {
    systemPromptTokens: number;
    toolTokens: number;
}

function computeOverhead({ systemPromptTokens, toolTokens }: TokenOverheadInput): number {
    return systemPromptTokens + toolTokens + BUDGET_SAFETY_MARGIN;
}

export function resolveRemoteOutputTokens(
    contextWindow: number | undefined,
    input: TokenOverheadInput,
): number {
    if (!contextWindow) return REMOTE_MAX_OUTPUT_TOKENS;

    const overhead = computeOverhead(input);
    const available = contextWindow - overhead - MIN_HISTORY_BUDGET;
    if (available >= REMOTE_MAX_OUTPUT_TOKENS) return REMOTE_MAX_OUTPUT_TOKENS;

    return Math.max(REMOTE_MIN_OUTPUT_TOKENS, available);
}

export function calculateRemoteTokenBudget(
    contextWindow: number | undefined,
    input: TokenOverheadInput,
): number {
    if (!contextWindow) {
        return DEFAULT_REMOTE_TOKEN_BUDGET;
    }

    const overhead = computeOverhead(input);
    const outputReserve = resolveRemoteOutputTokens(contextWindow, input);
    const budget = contextWindow - overhead - outputReserve;

    return Math.max(MIN_HISTORY_BUDGET, Math.min(budget, MAX_HISTORY_BUDGET));
}

export function measurePromptTokens(prompt: string): number {
    return estimateTokenCount(prompt);
}

export function measureToolTokens(tools: Record<string, Tool<any, any>>): number {
    const text = Object.entries(tools)
        .map(([name, tool]) => {
            const schema = resolveToolSchema(tool.inputSchema ?? (tool as any).parameters);
            const description = typeof tool.description === 'string' ? tool.description : '';
            return `${name}:${description}:${JSON.stringify(schema)}`;
        })
        .join('\n');

    return estimateTokenCount(text);
}

function resolveToolSchema(schema: FlexibleSchema<any>): unknown {
    if (schema == null || schema == undefined) {
        return {};
    }

    try {
        const normalized = asSchema(schema).jsonSchema;
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
