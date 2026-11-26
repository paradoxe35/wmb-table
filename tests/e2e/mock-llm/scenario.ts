export const MOCK_MODEL_ID = 'mock-model';
export const MOCK_CONTEXT_WINDOW = 128_000;
export const MOCK_MAX_COMPLETION_TOKENS = 16_384;

export type ChatMessageContent = string | { type: string; text?: string }[] | null;

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: ChatMessageContent;
    tool_calls?: { id: string; function: { name: string; arguments: string } }[];
    tool_call_id?: string;
}

export interface ChatRequest {
    model: string;
    messages: ChatMessage[];
    stream?: boolean;
    max_tokens?: number;
    tools?: { type: 'function'; function: { name: string } }[];
    reasoning_effort?: string;
    [key: string]: unknown;
}

export interface ToolResult {
    toolName: string;
    toolCallId: string;
    content: string;
}

export interface ScenarioContext {
    request: ChatRequest;
    tag: string | null;
    /** Model calls already made since the tagged user message (0 on the first call). */
    stepIndex: number;
    params: Record<string, string>;
    toolResults: ToolResult[];
    userText: string;
}

export type ReplyEvent =
    | { type: 'text'; text: string; wordsPerChunk?: number }
    | { type: 'reasoning'; text: string; wordsPerChunk?: number }
    | { type: 'tool-call'; name: string; args: Record<string, unknown> }
    | { type: 'pause'; ms: number }
    | { type: 'drop' };

export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter';

export interface CompletionReply {
    kind: 'completion';
    events: ReplyEvent[];
    finishReason?: FinishReason;
    chunkDelayMs?: number;
    usage?: { prompt: number; completion: number; reasoning?: number };
}

export interface HttpErrorReply {
    kind: 'http-error';
    status: number;
    error: { message: string; type: string; code?: string };
}

export type Reply = CompletionReply | HttpErrorReply;

export interface Scenario {
    name: string;
    description: string;
    /** Picked without a tag when this returns true (title generation, provider test). */
    matches?: (ctx: ScenarioContext) => boolean;
    reply: (ctx: ScenarioContext) => Reply;
}

export const text = (value: string, wordsPerChunk?: number): ReplyEvent => ({
    type: 'text',
    text: value,
    wordsPerChunk,
});

export const reasoning = (value: string, wordsPerChunk?: number): ReplyEvent => ({
    type: 'reasoning',
    text: value,
    wordsPerChunk,
});

export const toolCall = (name: string, args: Record<string, unknown>): ReplyEvent => ({
    type: 'tool-call',
    name,
    args,
});

export const pause = (ms: number): ReplyEvent => ({ type: 'pause', ms });

export const drop = (): ReplyEvent => ({ type: 'drop' });

export const complete = (
    events: ReplyEvent[],
    options: Omit<CompletionReply, 'kind' | 'events'> = {},
): Reply => ({ kind: 'completion', events, ...options });

export const httpError = (status: number, message: string, type: string, code?: string): Reply => ({
    kind: 'http-error',
    status,
    error: { message, type, code },
});

/** Plays one step per model call of the turn, then repeats the last one. */
export const sequence =
    (...steps: ((ctx: ScenarioContext) => Reply)[]) =>
    (ctx: ScenarioContext): Reply =>
        steps[Math.min(ctx.stepIndex, steps.length - 1)](ctx);

const FILLER =
    'The mock model writes this sentence to fill the answer with predictable words so the ' +
    'interface has something long enough to scroll, wrap and stream.';

export function words(count: number): string {
    const base = FILLER.split(' ');
    return Array.from({ length: count }, (_, i) => base[i % base.length]).join(' ');
}
