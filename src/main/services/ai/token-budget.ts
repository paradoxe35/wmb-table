import { asSchema, FlexibleSchema, Tool } from 'ai';
import { estimateTokenCount } from 'tokenx';

export const DEFAULT_REMOTE_TOKEN_BUDGET = 32_000;
export const MAX_HISTORY_BUDGET = 200_000;

export const FINAL_ANSWER_MAX_OUTPUT_TOKENS = 32_768;
export const TOOL_STEP_MAX_OUTPUT_TOKENS = 16_384;
/** Used when the model's own limit is unknown: an output cap above it would be refused. */
export const UNKNOWN_MODEL_MAX_OUTPUT_TOKENS = 8_192;
/** Pruning needs a window to aim for, even when the model does not publish one. */
export const ASSUMED_CONTEXT_WINDOW = 64_000;

const MIN_ANSWER_TOKENS = 1_024;
const MIN_STEP_OUTPUT_TOKENS = 256;
const ANSWER_SHARE_OF_WINDOW = 0.25;
const SAFETY_MARGIN_SHARE = 0.02;
const MIN_SAFETY_MARGIN = 256;
/** The rest of the prompt room stays free for the tool results of the current run. */
const HISTORY_SHARE_OF_PROMPT = 0.6;
const TOOL_ROUND_SHARE_OF_PROMPT = 0.1;
const MIN_TOOL_ROUND_TOKENS = 512;
const MAX_TOOL_ROUND_TOKENS = 8_000;

export interface ModelLimits {
    contextWindow?: number;
    maxOutputTokens?: number;
}

export type StepPhase = 'research' | 'answer';

export interface RunBudget {
    contextWindow: number;
    contextWindowKnown: boolean;
    /** Output reserved for the final writing step, whatever the research costs. */
    answerTokens: number;
    /** The largest prompt (system, tools and messages) any step may send. */
    promptLimit: number;
    historyBudget: number;
    /** Room a further tool call and its result need on top of the current prompt. */
    toolRoundTokens: number;
    safetyMargin: number;
}

function positive(value: number | undefined): number | undefined {
    return value && value > 0 ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function planRunBudget(limits: ModelLimits, fixedPromptTokens: number): RunBudget {
    const knownWindow = positive(limits.contextWindow);
    const contextWindow = knownWindow ?? ASSUMED_CONTEXT_WINDOW;
    const answerCap = Math.min(
        FINAL_ANSWER_MAX_OUTPUT_TOKENS,
        positive(limits.maxOutputTokens) ?? UNKNOWN_MODEL_MAX_OUTPUT_TOKENS,
    );
    const answerTokens = Math.min(
        answerCap,
        Math.max(MIN_ANSWER_TOKENS, Math.floor(contextWindow * ANSWER_SHARE_OF_WINDOW)),
    );
    const safetyMargin = Math.max(
        MIN_SAFETY_MARGIN,
        Math.ceil(contextWindow * SAFETY_MARGIN_SHARE),
    );
    const promptLimit = Math.max(0, contextWindow - answerTokens - safetyMargin);
    const historyBudget = clamp(
        Math.floor((promptLimit - fixedPromptTokens) * HISTORY_SHARE_OF_PROMPT),
        0,
        MAX_HISTORY_BUDGET,
    );

    return {
        contextWindow,
        contextWindowKnown: knownWindow != null,
        answerTokens,
        promptLimit,
        historyBudget,
        toolRoundTokens: clamp(
            Math.floor(promptLimit * TOOL_ROUND_SHARE_OF_PROMPT),
            MIN_TOOL_ROUND_TOKENS,
            MAX_TOOL_ROUND_TOKENS,
        ),
        safetyMargin,
    };
}

/** A sub-agent sends its whole history again on every step, so it works in a smaller window
 * than the chat and condenses older results sooner. */
export const SUB_AGENT_CONTEXT_WINDOW = 64_000;

export function planSubAgentBudget(limits: ModelLimits, fixedPromptTokens: number): RunBudget {
    const knownWindow = positive(limits.contextWindow);
    return planRunBudget(
        {
            ...limits,
            contextWindow: knownWindow && Math.min(knownWindow, SUB_AGENT_CONTEXT_WINDOW),
        },
        fixedPromptTokens,
    );
}

export function resolveStepOutputTokens(
    budget: RunBudget,
    promptTokens: number,
    phase: StepPhase,
): number {
    const cap =
        phase === 'answer'
            ? budget.answerTokens
            : Math.min(TOOL_STEP_MAX_OUTPUT_TOKENS, budget.answerTokens);
    const room = budget.contextWindow - promptTokens - budget.safetyMargin;
    return Math.max(MIN_STEP_OUTPUT_TOKENS, Math.min(cap, room));
}

export function canFitToolRound(budget: RunBudget, promptTokens: number): boolean {
    return promptTokens + budget.toolRoundTokens <= budget.promptLimit;
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
