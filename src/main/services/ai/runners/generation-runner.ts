import {
    streamText,
    stepCountIs,
    ToolChoiceViolationError,
    type ModelMessage,
    type TextStreamPart,
    type ToolSet,
} from 'ai';
import log from '@main/lib/logger';
import {
    isToolErrorOutput,
    type AiRunFinishReason,
    type AiRunOutcome,
    type AiRunStoppedBy,
} from '@shared/ai.types';
import { AiTimeoutError, isTimeoutReason, timeoutKindOf } from '../model-timeouts';
import type { GenerationContext, GenerationRunner } from './types';
import { withoutUnansweredToolCalls } from '../steps/step-messages';
import { StepPlanner, type PassMode } from '../steps/step-planner';
import {
    dispatchReasoningDelta,
    dispatchToolCallStart,
    dispatchToolCallComplete,
} from './stream-dispatcher';

const DEFAULT_MAX_STEPS = 50;
const MAX_CONTINUATIONS = 2;
const AI_STREAM_MAX_RETRIES = 3;
const AGENT_TOOL_NAMES = ['researchTopic', 'readSermon'] as const;

const CONTINUE_PROMPT =
    'Your previous reply was cut off by the output limit. Continue exactly where it stopped, ' +
    'from the next word. Do not repeat anything already written and do not add an introduction.';
const WRITE_ANSWER_PROMPT = 'Write the final answer now, from the research above.';

type FollowUp = 'continue' | 'write' | 'write-without-tools';

interface PassResult {
    finishReason: AiRunFinishReason;
    stoppedBy: AiRunStoppedBy;
    steps: number;
    textChars: number;
    toolChoiceViolated: boolean;
    inputTokens: number;
    outputTokens: number;
    responseMessages: () => Promise<ModelMessage[]>;
}

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

function toErrorMessage(error: unknown, fallback = 'Tool execution failed.'): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return fallback;
}

function nextFollowUp(pass: PassResult, totalTextChars: number): FollowUp | null {
    if (pass.toolChoiceViolated) return 'write-without-tools';
    if (pass.finishReason === 'length') return pass.textChars > 0 ? 'continue' : 'write';
    if (totalTextChars === 0 && pass.finishReason !== 'content-filter') return 'write';
    return null;
}

/** Each step opens its own text block; without a separator the last sentence of one step and
 * the first of the next run together. A continuation joins the cut text instead. */
class AnswerText {
    totalChars = 0;
    private needsSeparator = false;
    private joinNextBlock = false;

    constructor(private readonly dispatch: (delta: string) => void) {}

    startPass(join: boolean): void {
        this.joinNextBlock = join;
    }

    startBlock(): void {
        this.needsSeparator = this.totalChars > 0 && !this.joinNextBlock;
        this.joinNextBlock = false;
    }

    write(text: string): void {
        if (!text) return;
        if (this.needsSeparator) {
            this.dispatch('\n\n');
            this.needsSeparator = false;
        }
        this.totalChars += text.length;
        this.dispatch(text);
    }
}

export class GenerationRunnerImpl implements GenerationRunner {
    async run(ctx: GenerationContext): Promise<AiRunOutcome> {
        const startedAt = Date.now();
        const planner = new StepPlanner({
            budget: ctx.budget,
            fixedPromptTokens: ctx.fixedPromptTokens,
            systemPrompt: ctx.systemPrompt,
            maxSteps: ctx.maxSteps ?? DEFAULT_MAX_STEPS,
            reasoningControl: ctx.reasoningControl,
        });
        const answer = new AnswerText(ctx.dispatchTextDelta);
        const deadline = startedAt + ctx.timeouts.totalMs;

        let messages: ModelMessage[] = ctx.history;
        let pass = await this.runPass(ctx, planner, answer, messages, 'research', deadline);
        let steps = pass.steps;
        let continuations = 0;
        let inputTokens = pass.inputTokens;
        let outputTokens = pass.outputTokens;

        for (
            let followUp = nextFollowUp(pass, answer.totalChars);
            followUp && continuations < MAX_CONTINUATIONS && !ctx.abortSignal.aborted;
            followUp = nextFollowUp(pass, answer.totalChars)
        ) {
            continuations++;
            const prompt = followUp === 'continue' ? CONTINUE_PROMPT : WRITE_ANSWER_PROMPT;
            messages = withoutUnansweredToolCalls([
                ...messages,
                ...(await pass.responseMessages()),
                { role: 'user', content: prompt },
            ]);
            answer.startPass(followUp === 'continue');
            const mode: PassMode =
                followUp === 'write-without-tools' ? 'answer-without-tools' : 'answer';
            pass = await this.runPass(ctx, planner, answer, messages, mode, deadline);
            steps += pass.steps;
            inputTokens += pass.inputTokens;
            outputTokens += pass.outputTokens;
        }

        const outcome: AiRunOutcome = {
            finishReason: pass.finishReason,
            stoppedBy: pass.stoppedBy,
            truncated: pass.finishReason === 'length',
            stepLimitReached: planner.finalStepReason === 'step-limit',
            steps,
            continuations,
        };
        log.info('AI run finished', {
            conversationId: ctx.conversationId,
            ...outcome,
            finalStepReason: planner.finalStepReason,
            prunedSteps: planner.plans.filter((plan) => plan.pruned).length,
            largestPromptTokens: Math.max(0, ...planner.plans.map((plan) => plan.promptTokens)),
            promptLimit: ctx.budget.promptLimit,
            answerTokens: ctx.budget.answerTokens,
            inputTokens,
            outputTokens,
            answerChars: answer.totalChars,
            durationMs: Date.now() - startedAt,
        });
        return outcome;
    }

    private async runPass(
        ctx: GenerationContext,
        planner: StepPlanner,
        answer: AnswerText,
        messages: ModelMessage[],
        mode: PassMode,
        deadline: number,
    ): Promise<PassResult> {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
            throw new AiTimeoutError('total');
        }

        planner.startPass();
        const result = streamText({
            model: ctx.model,
            system: ctx.systemPrompt,
            messages,
            tools: ctx.tools,
            maxRetries: AI_STREAM_MAX_RETRIES,
            stopWhen: stepCountIs(mode === 'research' ? (ctx.maxSteps ?? DEFAULT_MAX_STEPS) : 1),
            prepareStep: (input) => planner.prepareStep(mode, input),
            abortSignal: ctx.abortSignal,
            timeout: {
                totalMs: remainingMs,
                stepMs: ctx.timeouts.stepMs,
                firstChunkMs: ctx.timeouts.firstChunkMs,
                chunkMs: ctx.timeouts.chunkMs,
                toolMs: ctx.timeouts.toolMs,
                tools: Object.fromEntries(
                    AGENT_TOOL_NAMES.map((name) => [`${name}Ms`, ctx.timeouts.agentToolMs]),
                ),
            },
        });

        const pass: PassResult = {
            finishReason: 'other',
            stoppedBy: 'model',
            steps: 0,
            textChars: 0,
            toolChoiceViolated: false,
            inputTokens: 0,
            outputTokens: 0,
            responseMessages: async () => (await result.response).messages,
        };

        try {
            for await (const part of result.fullStream) {
                this.handlePart(ctx, part, pass, answer);
            }
        } catch (error) {
            if (error instanceof AiTimeoutError) throw error;
            if (!ctx.abortSignal.aborted && isTimeoutReason(error)) {
                throw new AiTimeoutError(timeoutKindOf(error));
            }
            throw error;
        }
        return pass;
    }

    private handlePart(
        ctx: GenerationContext,
        part: TextStreamPart<ToolSet>,
        pass: PassResult,
        answer: AnswerText,
    ): void {
        switch (part.type) {
            case 'text-start':
                answer.startBlock();
                break;
            case 'text-delta':
                pass.textChars += part.text.length;
                answer.write(part.text);
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
                this.completeToolCall(ctx, part.toolCallId, part.toolName, part.output);
                break;
            case 'tool-error':
                log.warn('AI tool error', {
                    conversationId: ctx.conversationId,
                    toolName: part.toolName,
                    error: part.error,
                });
                this.completeToolCall(ctx, part.toolCallId, part.toolName, {
                    error: toErrorMessage(part.error),
                });
                break;
            case 'finish-step':
                pass.steps++;
                pass.inputTokens += part.usage.inputTokens ?? 0;
                pass.outputTokens += part.usage.outputTokens ?? 0;
                break;
            case 'finish':
                pass.finishReason = part.finishReason;
                pass.stoppedBy = part.stoppedBy ?? 'model';
                break;
            case 'abort':
                if (!ctx.abortSignal.aborted && isTimeoutReason(part.reason)) {
                    throw new AiTimeoutError(timeoutKindOf(part.reason));
                }
                break;
            case 'error':
                if (ToolChoiceViolationError.isInstance(part.error)) {
                    log.warn('Model called a tool after tools were closed', {
                        conversationId: ctx.conversationId,
                    });
                    pass.toolChoiceViolated = true;
                    break;
                }
                throw new Error(toErrorMessage(part.error, 'AI stream failed.'));
            default:
                break;
        }
    }

    private completeToolCall(
        ctx: GenerationContext,
        toolCallId: string,
        name: string,
        output: unknown,
    ): void {
        dispatchToolCallComplete(
            ctx.browserWindow,
            ctx.conversationId,
            ctx.generationId,
            ctx.assistantMessageId,
            { toolCallId, name, output, isError: isToolErrorOutput(output) },
            ctx.isCurrentRun,
        );
    }
}
