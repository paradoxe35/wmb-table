import { streamText, stepCountIs } from 'ai';
import log from '@main/lib/logger';
import { resolveRemoteOutputTokens } from '../token-budget';
import type { GenerationContext, GenerationRunner } from './types';
import {
    dispatchTextDelta,
    dispatchReasoningDelta,
    dispatchToolCallStart,
    dispatchToolCallComplete,
} from './stream-dispatcher';

const TRUNCATION_NOTICE = '\n\n---\n*[Response truncated due to length limit]*';

const REMOTE_MAX_STEPS = 40;
const LOCAL_MAX_STEPS = 15;
const LOCAL_MAX_OUTPUT_TOKENS = 1024;

function normalizeToolCallInput(input: unknown): Record<string, unknown> {
    if (input && typeof input === 'object' && !Array.isArray(input)) {
        return input as Record<string, unknown>;
    }

    if (typeof input === 'string') {
        try {
            const parsed = JSON.parse(input);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
        } catch {
            // Ignore invalid provider-formatted JSON and fall through to empty input.
        }
    }

    return {};
}

export class GenerationRunnerImpl implements GenerationRunner {
    constructor(private readonly isLocal: boolean) {}

    async run(ctx: GenerationContext): Promise<void> {
        const maxSteps = this.isLocal ? LOCAL_MAX_STEPS : REMOTE_MAX_STEPS;
        const maxOutputTokens = this.isLocal
            ? LOCAL_MAX_OUTPUT_TOKENS
            : resolveRemoteOutputTokens(ctx.contextWindow, ctx.toolTokens);

        const result = streamText({
            model: ctx.model,
            system: ctx.systemPrompt,
            messages: ctx.history,
            tools: ctx.tools,
            maxOutputTokens,
            stopWhen: stepCountIs(maxSteps),
            abortSignal: ctx.abortSignal,
        });

        let lastFinishReason: string | undefined;

        for await (const part of result.fullStream) {
            switch (part.type) {
                case 'text-delta':
                    dispatchTextDelta(
                        ctx.browserWindow,
                        ctx.conversationId,
                        ctx.assistantMessageId,
                        part.text,
                    );
                    break;
                case 'reasoning-delta':
                    dispatchReasoningDelta(
                        ctx.browserWindow,
                        ctx.conversationId,
                        ctx.assistantMessageId,
                        part.text,
                    );
                    break;
                case 'tool-call':
                    dispatchToolCallStart(
                        ctx.browserWindow,
                        ctx.conversationId,
                        ctx.assistantMessageId,
                        {
                            id: part.toolCallId,
                            name: part.toolName,
                            input: normalizeToolCallInput(part.input),
                        },
                    );
                    break;
                case 'tool-result':
                    dispatchToolCallComplete(
                        ctx.browserWindow,
                        ctx.conversationId,
                        ctx.assistantMessageId,
                        {
                            toolCallId: part.toolCallId,
                            name: part.toolName,
                            output: part.output,
                        },
                    );
                    break;
                case 'tool-error':
                    log.warn('AI tool error', {
                        conversationId: ctx.conversationId,
                        toolName: part.toolName,
                        error: part.error,
                    });
                    break;
                case 'finish-step':
                    lastFinishReason = part.finishReason;
                    break;
                case 'error':
                    throw new Error(
                        typeof part.error === 'string'
                            ? part.error
                            : part.error instanceof Error
                              ? part.error.message
                              : 'AI stream failed.',
                    );
                default:
                    break;
            }
        }
        if (lastFinishReason === 'length') {
            log.warn('AI response truncated by output token limit', {
                conversationId: ctx.conversationId,
                maxOutputTokens,
            });
            dispatchTextDelta(
                ctx.browserWindow,
                ctx.conversationId,
                ctx.assistantMessageId,
                TRUNCATION_NOTICE,
            );
        }
    }
}
