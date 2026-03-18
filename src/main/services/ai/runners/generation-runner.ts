import { streamText, stepCountIs } from 'ai';
import log from '@main/lib/logger';
import type { GenerationContext, GenerationRunner } from './types';
import {
    dispatchTextDelta,
    dispatchReasoningDelta,
    dispatchToolCallStart,
    dispatchToolCallComplete,
} from './stream-dispatcher';

const REMOTE_MAX_STEPS = 40;
const REMOTE_MAX_OUTPUT_TOKENS = 4096;
const LOCAL_MAX_STEPS = 15;
const LOCAL_MAX_OUTPUT_TOKENS = 1024;

/**
 * Unified generation runner for both local and remote providers.
 * Streams text and dispatches tool call/result events via IPC.
 */
export class GenerationRunnerImpl implements GenerationRunner {
    constructor(private readonly isLocal: boolean) {}

    async run(ctx: GenerationContext): Promise<void> {
        const maxSteps = this.isLocal ? LOCAL_MAX_STEPS : REMOTE_MAX_STEPS;
        const maxOutputTokens = this.isLocal ? LOCAL_MAX_OUTPUT_TOKENS : REMOTE_MAX_OUTPUT_TOKENS;

        const result = streamText({
            model: ctx.model,
            system: ctx.systemPrompt,
            messages: ctx.history,
            tools: ctx.tools,
            maxOutputTokens,
            stopWhen: stepCountIs(maxSteps),
            abortSignal: ctx.abortSignal,
        });

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
                            input: (part.input as Record<string, unknown>) ?? {},
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
    }
}
