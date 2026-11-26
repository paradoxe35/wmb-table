import type {
    ChatMessageContent,
    ChatRequest,
    CompletionReply,
    FinishReason,
    ReplyEvent,
    Scenario,
    ScenarioContext,
    ToolResult,
} from './scenario';

const SCENARIO_TAG = /#scenario:([\w-]+)/;
const PARAM_TAG = /#(\w+)=(\S+)/g;

export function contentText(content: ChatMessageContent | undefined): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    return content.map((part) => part.text ?? '').join('');
}

function lastIndexWhere<T>(items: T[], predicate: (item: T) => boolean): number {
    for (let i = items.length - 1; i >= 0; i--) {
        if (predicate(items[i])) return i;
    }
    return -1;
}

function collectToolResults(request: ChatRequest, fromIndex: number): ToolResult[] {
    const messages = request.messages.slice(fromIndex);
    const toolNames = new Map(
        messages.flatMap((message) =>
            (message.tool_calls ?? []).map((call) => [call.id, call.function.name] as const),
        ),
    );
    return messages
        .filter((message) => message.role === 'tool' && message.tool_call_id)
        .map((message) => ({
            toolCallId: message.tool_call_id ?? '',
            toolName: toolNames.get(message.tool_call_id ?? '') ?? 'unknown',
            content: contentText(message.content),
        }));
}

/** Reads the scenario tag, its params and the step of the turn from an OpenAI chat request. */
export function readScenarioContext(request: ChatRequest): ScenarioContext {
    const { messages } = request;
    const lastUserIndex = lastIndexWhere(messages, (m) => m.role === 'user');
    const taggedIndex = lastIndexWhere(
        messages,
        (m) => m.role === 'user' && SCENARIO_TAG.test(contentText(m.content)),
    );
    const turnStart = taggedIndex >= 0 ? taggedIndex : Math.max(lastUserIndex, 0);
    const taggedText = taggedIndex >= 0 ? contentText(messages[taggedIndex].content) : '';
    const params = Object.fromEntries(
        [...taggedText.matchAll(PARAM_TAG)].map(([, key, value]) => [key, value]),
    );
    return {
        request,
        tag: taggedText.match(SCENARIO_TAG)?.[1] ?? null,
        stepIndex: messages.slice(turnStart).filter((m) => m.role === 'assistant').length,
        params,
        toolResults: collectToolResults(request, turnStart),
        userText: lastUserIndex >= 0 ? contentText(messages[lastUserIndex].content) : '',
    };
}

export function pickScenario(
    ctx: ScenarioContext,
    scenarios: Scenario[],
    fallbackName: string,
): Scenario {
    const byMatcher = scenarios.find((scenario) => scenario.matches?.(ctx));
    const byTag = ctx.tag ? scenarios.find((scenario) => scenario.name === ctx.tag) : undefined;
    const fallback = scenarios.find((scenario) => scenario.name === fallbackName);
    const picked = byMatcher ?? byTag ?? fallback;
    if (!picked) throw new Error(`No scenario "${ctx.tag ?? fallbackName}"`);
    return picked;
}

export type WireFrame =
    | { type: 'data'; json: Record<string, unknown> }
    | { type: 'pause'; ms: number }
    | { type: 'drop' };

function splitWords(value: string, wordsPerChunk: number): string[] {
    const tokens = value.match(/\S+\s*|\s+/g) ?? [];
    const pieces: string[] = [];
    for (let i = 0; i < tokens.length; i += wordsPerChunk) {
        pieces.push(tokens.slice(i, i + wordsPerChunk).join(''));
    }
    return pieces;
}

function resolveFinishReason(reply: CompletionReply): FinishReason {
    const hasToolCall = reply.events.some((event) => event.type === 'tool-call');
    return reply.finishReason ?? (hasToolCall ? 'tool_calls' : 'stop');
}

function usageJson(reply: CompletionReply) {
    const usage = reply.usage ?? { prompt: 1000, completion: 50 };
    return {
        prompt_tokens: usage.prompt,
        completion_tokens: usage.completion,
        total_tokens: usage.prompt + usage.completion,
        completion_tokens_details: { reasoning_tokens: usage.reasoning ?? 0 },
    };
}

let toolCallCounter = 0;

/** Unique across the whole conversation, because scenarios map results back to tools by id. */
function toolCallId(): string {
    return `call_mock_${++toolCallCounter}`;
}

function eventDeltas(event: ReplyEvent, toolIndex: number): Record<string, unknown>[] {
    switch (event.type) {
        case 'text':
            return splitWords(event.text, event.wordsPerChunk ?? 1).map((content) => ({ content }));
        case 'reasoning':
            return splitWords(event.text, event.wordsPerChunk ?? 1).map((piece) => ({
                reasoning_content: piece,
            }));
        case 'tool-call': {
            const args = JSON.stringify(event.args);
            const half = Math.ceil(args.length / 2);
            const id = toolCallId();
            const name = event.name;
            return [
                {
                    tool_calls: [
                        {
                            index: toolIndex,
                            id,
                            type: 'function',
                            function: { name, arguments: '' },
                        },
                    ],
                },
                {
                    tool_calls: [
                        { index: toolIndex, function: { arguments: args.slice(0, half) } },
                    ],
                },
                { tool_calls: [{ index: toolIndex, function: { arguments: args.slice(half) } }] },
            ];
        }
        default:
            return [];
    }
}

export function encodeStreamFrames(reply: CompletionReply, model: string): WireFrame[] {
    const created = Math.floor(Date.now() / 1000);
    const chunk = (choices: unknown[], extra: Record<string, unknown> = {}): WireFrame => ({
        type: 'data',
        json: {
            id: 'chatcmpl-mock',
            object: 'chat.completion.chunk',
            created,
            model,
            choices,
            ...extra,
        },
    });
    const deltaChunk = (delta: Record<string, unknown>) =>
        chunk([{ index: 0, delta, finish_reason: null }]);

    const frames: WireFrame[] = [deltaChunk({ role: 'assistant', content: '' })];
    let toolIndex = 0;
    for (const event of reply.events) {
        if (event.type === 'pause') frames.push({ type: 'pause', ms: event.ms });
        if (event.type === 'drop') return [...frames, { type: 'drop' }];
        frames.push(...eventDeltas(event, toolIndex).map(deltaChunk));
        if (event.type === 'tool-call') toolIndex++;
    }
    frames.push(chunk([{ index: 0, delta: {}, finish_reason: resolveFinishReason(reply) }]));
    frames.push(chunk([], { usage: usageJson(reply) }));
    return frames;
}

export interface EncodedCompletion {
    body: Record<string, unknown>;
    pauseMs: number;
    drops: boolean;
}

export function encodeCompletionJson(reply: CompletionReply, model: string): EncodedCompletion {
    const joined = (type: 'text' | 'reasoning') =>
        reply.events.flatMap((event) => (event.type === type ? [event.text] : [])).join('');
    const toolCalls = reply.events
        .flatMap((event) => (event.type === 'tool-call' ? [event] : []))
        .map((event) => ({
            id: toolCallId(),
            type: 'function',
            function: { name: event.name, arguments: JSON.stringify(event.args) },
        }));
    const message = {
        role: 'assistant',
        content: joined('text') || null,
        reasoning_content: joined('reasoning') || undefined,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    };
    return {
        body: {
            id: 'chatcmpl-mock',
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{ index: 0, message, finish_reason: resolveFinishReason(reply) }],
            usage: usageJson(reply),
        },
        pauseMs: reply.events.reduce((sum, e) => sum + (e.type === 'pause' ? e.ms : 0), 0),
        drops: reply.events.some((event) => event.type === 'drop'),
    };
}
