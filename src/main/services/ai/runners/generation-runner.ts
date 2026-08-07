import { streamText, stepCountIs } from 'ai';
import log from '@main/lib/logger';
import { resolveRemoteOutputTokens } from '../token-budget';
import type { GenerationContext, GenerationRunner } from './types';
import {
    dispatchReasoningDelta,
    dispatchToolCallStart,
    dispatchToolCallComplete,
} from './stream-dispatcher';

const TRUNCATION_NOTICE = '\n\n---\n*[Response truncated due to length limit]*';

const REMOTE_MAX_STEPS = 50;
const AI_STREAM_MAX_RETRIES = 3;

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
    async run(ctx: GenerationContext): Promise<void> {
        const maxOutputTokens = resolveRemoteOutputTokens({
            modelLimits: {
                contextWindow: ctx.contextWindow,
                maxOutputTokens: ctx.maxOutputTokens,
            },
            prompt: {
                toolTokens: ctx.toolTokens,
                systemPromptTokens: ctx.systemPromptTokens,
            },
        });

        const result = streamText({
            model: ctx.model,
            system: ctx.systemPrompt,
            messages: ctx.history,
            tools: ctx.tools,
            maxOutputTokens,
            maxRetries: AI_STREAM_MAX_RETRIES,
            stopWhen: stepCountIs(REMOTE_MAX_STEPS),
            abortSignal: ctx.abortSignal,
        });

        let lastFinishReason: string | undefined;

        for await (const part of result.fullStream) {
            switch (part.type) {
                case 'text-delta':
                    ctx.dispatchTextDelta(part.text);
                    break;
                case 'reasoning-delta':
                    dispatchReasoningDelta(
                        ctx.browserWindow,
                        ctx.conversationId,
                        ctx.generationId,
                        ctx.assistantMessageId,
                        part.text,
                        ctx.isCurrentRun,
                    );
                    break;
                case 'tool-call':
                    dispatchToolCallStart(
                        ctx.browserWindow,
                        ctx.conversationId,
                        ctx.generationId,
                        ctx.assistantMessageId,
                        {
                            id: part.toolCallId,
                            name: part.toolName,
                            input: normalizeToolCallInput(part.input),
                        },
                        ctx.isCurrentRun,
                    );
                    break;
                case 'tool-result':
                    dispatchToolCallComplete(
                        ctx.browserWindow,
                        ctx.conversationId,
                        ctx.generationId,
                        ctx.assistantMessageId,
                        {
                            toolCallId: part.toolCallId,
                            name: part.toolName,
                            output: part.output,
                        },
                        ctx.isCurrentRun,
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
            ctx.dispatchTextDelta(TRUNCATION_NOTICE);
        }
    }
}
