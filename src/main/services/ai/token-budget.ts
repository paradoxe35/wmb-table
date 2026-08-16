import { asSchema, FlexibleSchema, Tool } from 'ai';
import { estimateTokenCount } from 'tokenx';

const BUDGET_SAFETY_MARGIN = 512;

export const DEFAULT_REMOTE_TOKEN_BUDGET = 32_000;
export const MIN_HISTORY_BUDGET = 4_000;
export const MAX_HISTORY_BUDGET = 200_000;

export const REMOTE_MAX_OUTPUT_TOKENS = 8_192;
export const REMOTE_MIN_OUTPUT_TOKENS = 2_048;
export const MIN_REMOTE_CONTEXT_WINDOW = 16_000;

interface TokenOverheadInput {
    systemPromptTokens: number;
    toolTokens: number;
}

interface RemoteTokenBudgetInput {
    modelLimits: {
        contextWindow?: number;
        maxOutputTokens?: number;
    };
    prompt: TokenOverheadInput;
}

function computeOverhead({ systemPromptTokens, toolTokens }: TokenOverheadInput): number {
    return systemPromptTokens + toolTokens + BUDGET_SAFETY_MARGIN;
}

function resolveOutputCap(maxOutputTokens: number | undefined): number | undefined {
    return maxOutputTokens && maxOutputTokens > 0 ? maxOutputTokens : undefined;
}

export function resolveRemoteOutputTokens(input: RemoteTokenBudgetInput): number {
    const { contextWindow, maxOutputTokens } = input.modelLimits;
    const cap = resolveOutputCap(maxOutputTokens);
    if (!contextWindow) {
        return cap ? Math.min(REMOTE_MAX_OUTPUT_TOKENS, cap) : REMOTE_MAX_OUTPUT_TOKENS;
    }

    const overhead = computeOverhead(input.prompt);
    const available = contextWindow - overhead - MIN_HISTORY_BUDGET;
    const headroom = Math.max(1, contextWindow - overhead);
    const resolved =
        available >= REMOTE_MAX_OUTPUT_TOKENS
            ? REMOTE_MAX_OUTPUT_TOKENS
            : Math.min(Math.max(REMOTE_MIN_OUTPUT_TOKENS, available), headroom);

    return cap ? Math.max(1, Math.min(resolved, cap)) : resolved;
}

export function calculateRemoteTokenBudget(input: RemoteTokenBudgetInput): number {
    const { contextWindow } = input.modelLimits;
    if (!contextWindow) {
        return DEFAULT_REMOTE_TOKEN_BUDGET;
    }

    const overhead = computeOverhead(input.prompt);
    const outputReserve = resolveRemoteOutputTokens(input);
    const budget = Math.max(0, contextWindow - overhead - outputReserve);

    return Math.min(budget, MAX_HISTORY_BUDGET);
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
