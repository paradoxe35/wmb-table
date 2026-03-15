import { streamText, stepCountIs } from 'ai';
import log from '@main/lib/logger';
import type { GenerationContext, GenerationRunner } from './types';
import {
    dispatchTextDelta,
    dispatchToolCallStart,
    dispatchToolCallComplete,
} from './stream-dispatcher';

/** Maximum number of tool-calling steps before the model must stop. */
const REMOTE_MAX_STEPS = 30;
const LOCAL_MAX_STEPS = 10;

/**
 * Unified generation runner for both local and remote providers.
 * Streams text and dispatches tool call/result events via IPC.
 */
export class GenerationRunnerImpl implements GenerationRunner {
    constructor(private readonly isLocal: boolean) {}

    async run(ctx: GenerationContext): Promise<void> {
        const maxSteps = this.isLocal ? LOCAL_MAX_STEPS : REMOTE_MAX_STEPS;

        const result = streamText({
            model: ctx.model,
            system: ctx.systemPrompt,
            messages: ctx.history,
            tools: ctx.tools,
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
