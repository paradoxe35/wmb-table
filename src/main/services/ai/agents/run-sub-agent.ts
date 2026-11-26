import {
    generateText,
    isStepCount,
    tool,
    ToolChoiceViolationError,
    type FinishReason,
    type ModelMessage,
    type ToolExecutionEndEvent,
    type ToolSet,
} from 'ai';
import pLimitModule from 'p-limit';
import log from '@main/lib/logger';
import { resolveDefaultExport } from '@main/lib/module-interop';
import { isToolErrorOutput } from '@shared/ai.types';
import {
    isTimeoutReason,
    resolveChatTimeouts,
    resolveSubAgentDeadlines,
    type ChatTimeouts,
} from '../model-timeouts';
import { withoutUnansweredToolCalls } from '../steps/step-messages';
import { StepPlanner, type PassMode } from '../steps/step-planner';
import { measurePromptTokens, measureToolTokens, planSubAgentBudget } from '../token-budget';
import type { AiToolDefinition } from '../tools/types';
import { dispatchAgentToolComplete, dispatchAgentToolStart } from './agent-dispatcher';
import type { AgentContext } from './types';

const pLimit = resolveDefaultExport(pLimitModule);

/** Each sub-agent runs a whole tool loop; more at once mostly multiplies cost and rate limits. */
export const MAX_PARALLEL_SUB_AGENTS = 2;
const SUB_AGENT_MAX_RETRIES = 3;
const MAX_FOLLOW_UPS = 1;

const REPORT_NOTE = [
    '<system-reminder>',
    'The research phase is over: no more tool calls are possible.',
    'Write your report now, from the tool results above, in the format your instructions ask for, with the citations you already have.',
    'If something could not be checked, say so in one short sentence.',
    '</system-reminder>',
].join('\n');
const CONTINUE_PROMPT =
    'Your report was cut off by the output limit. Continue exactly where it stopped, from the ' +
    'next word. Do not repeat anything already written and do not add an introduction.';
const WRITE_REPORT_PROMPT = 'Write your report now, from the research above.';

export type SubAgentStatus = 'completed' | 'incomplete' | 'failed';
export type SubAgentStopReason =
    'step-limit' | 'context' | 'time-limit' | 'report-cut' | 'no-report' | 'timeout' | 'error';

export interface SubAgentResult {
    status: SubAgentStatus;
    response: string;
    reason?: SubAgentStopReason;
    error?: string;
    steps: number;
    durationMs: number;
}

export interface SubAgentTask {
    /** Tool name of the agent, also the prefix of its progress events (`researchTopic:searchContent`). */
    name: string;
    /** Starts the failure text the parent model reads ("Research failed: …"). */
    label: string;
    instructions: string;
    prompt: string;
    tools: Record<string, AiToolDefinition>;
    maxSteps: number;
    logContext: Record<string, unknown>;
}

export type SubAgentRunner = (task: SubAgentTask) => Promise<SubAgentResult>;

const INCOMPLETE_NOTES: Record<'step-limit' | 'context' | 'time-limit' | 'report-cut', string> = {
    'step-limit': 'it used all its research steps',
    context: 'its working memory was full',
    'time-limit': 'its time ran out',
    'report-cut': 'the report was cut by the output limit',
};

type FollowUp = 'continue' | 'write' | 'write-without-tools';

interface PassResult {
    text: string;
    finishReason: FinishReason;
    toolChoiceViolated: boolean;
    messages: ModelMessage[];
}

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return typeof error === 'string' ? error : 'Tool failed.';
}

function toolEndError(event: ToolExecutionEndEvent): string | undefined {
    const { toolOutput } = event;
    if (toolOutput.type === 'tool-error') return errorMessage(toolOutput.error);
    if (!isToolErrorOutput(toolOutput.output)) return undefined;
    const { error } = toolOutput.output as { error?: unknown };
    return typeof error === 'string' && error ? error : 'Tool failed.';
}

function nextFollowUp(pass: PassResult): FollowUp | null {
    if (pass.toolChoiceViolated) return 'write-without-tools';
    if (pass.finishReason === 'length') return pass.text.trim() ? 'continue' : 'write';
    return pass.text.trim() ? null : 'write';
}

function finishedResult(
    report: string,
    lastPass: PassResult,
    planner: StepPlanner,
    label: string,
): Pick<SubAgentResult, 'status' | 'response' | 'reason'> {
    if (!report.trim()) {
        return {
            status: 'failed',
            reason: 'no-report',
            response: `${label} failed: the model returned no report.`,
        };
    }
    const reason = lastPass.finishReason === 'length' ? 'report-cut' : planner.finalStepReason;
    if (!reason) return { status: 'completed', response: report };
    return {
        status: 'incomplete',
        reason,
        response:
            `${report}\n\n[Report incomplete: ${INCOMPLETE_NOTES[reason]}. ` +
            'Tell the user what may be missing, or call again with `alreadyKnown` and a narrower goal.]',
    };
}

function failedResult(
    error: unknown,
    timedOut: boolean,
    label: string,
): Pick<SubAgentResult, 'status' | 'response' | 'reason' | 'error'> {
    if (timedOut) {
        return {
            status: 'failed',
            reason: 'timeout',
            response: `${label} failed: the model did not answer in time.`,
            error: errorMessage(error),
        };
    }
    const message = errorMessage(error);
    return {
        status: 'failed',
        reason: 'error',
        response: `${label} failed: ${message}`,
        error: message,
    };
}

class SubAgentRun {
    private readonly startedAt = Date.now();
    private readonly timeouts: ChatTimeouts;
    private readonly deadline: number;
    private readonly planner: StepPlanner;
    private readonly tools: ToolSet;

    constructor(
        private readonly ctx: AgentContext,
        private readonly task: SubAgentTask,
    ) {
        this.timeouts = ctx.timeouts ?? resolveChatTimeouts(false);
        const { wrapUpAt, deadline } = resolveSubAgentDeadlines(this.timeouts, this.startedAt);
        this.deadline = deadline;
        this.tools = Object.fromEntries(
            Object.entries(task.tools).map(([name, definition]) => [name, tool(definition)]),
        );
        const fixedPromptTokens =
            measurePromptTokens(task.instructions) + measureToolTokens(this.tools);
        this.planner = new StepPlanner({
            budget: planSubAgentBudget(
                { contextWindow: ctx.contextWindow, maxOutputTokens: ctx.maxOutputTokens },
                fixedPromptTokens,
            ),
            fixedPromptTokens,
            systemPrompt: task.instructions,
            maxSteps: task.maxSteps,
            reasoningControl: ctx.reasoningControl ?? false,
            finalStepNote: REPORT_NOTE,
            wrapUpAt,
        });
    }

    async run(): Promise<SubAgentResult> {
        this.ctx.abortSignal?.throwIfAborted();
        log.info('Sub-agent starting', { agent: this.task.name, ...this.task.logContext });
        try {
            const result = await this.research();
            this.logFinish(result);
            return result;
        } catch (error) {
            if (this.ctx.abortSignal?.aborted) throw error;
            const timedOut = isTimeoutReason(error) || Date.now() >= this.deadline;
            const result = { ...failedResult(error, timedOut, this.task.label), ...this.stats() };
            log.error('Sub-agent failed', {
                agent: this.task.name,
                ...this.task.logContext,
                reason: result.reason,
                error: result.error,
                steps: result.steps,
                durationMs: result.durationMs,
            });
            return result;
        }
    }

    private async research(): Promise<SubAgentResult> {
        let pass = await this.runPass([{ role: 'user', content: this.task.prompt }], 'research');
        let report = pass.text;

        for (
            let followUp = nextFollowUp(pass), count = 0;
            followUp && count < MAX_FOLLOW_UPS && Date.now() < this.deadline;
            followUp = nextFollowUp(pass), count++
        ) {
            this.ctx.abortSignal?.throwIfAborted();
            const messages = withoutUnansweredToolCalls([
                ...pass.messages,
                {
                    role: 'user',
                    content: followUp === 'continue' ? CONTINUE_PROMPT : WRITE_REPORT_PROMPT,
                },
            ]);
            pass = await this.runPass(
                messages,
                followUp === 'write-without-tools' ? 'answer-without-tools' : 'answer',
            );
            report = followUp === 'continue' ? report + pass.text : pass.text;
        }

        return { ...finishedResult(report, pass, this.planner, this.task.label), ...this.stats() };
    }

    private async runPass(messages: ModelMessage[], mode: PassMode): Promise<PassResult> {
        let lastStepMessages = messages;
        this.planner.startPass();
        try {
            const result = await generateText({
                model: this.ctx.model,
                instructions: this.task.instructions,
                messages,
                tools: this.tools,
                stopWhen: isStepCount(mode === 'research' ? this.task.maxSteps : 1),
                prepareStep: (input) => {
                    lastStepMessages = input.messages;
                    return this.planner.prepareStep(mode, input);
                },
                maxRetries: SUB_AGENT_MAX_RETRIES,
                abortSignal: this.ctx.abortSignal,
                timeout: {
                    totalMs: Math.max(1, this.deadline - Date.now()),
                    stepMs: this.timeouts.stepMs,
                    toolMs: this.timeouts.toolMs,
                },
                onToolExecutionStart: (event) => {
                    this.progress((dispatch) =>
                        dispatchAgentToolStart(
                            dispatch,
                            this.task.name,
                            event.toolCall.toolName,
                            event.toolCall.toolCallId,
                            (event.toolCall.input as Record<string, unknown>) ?? {},
                        ),
                    );
                },
                onToolExecutionEnd: (event) => {
                    this.progress((dispatch) =>
                        dispatchAgentToolComplete(
                            dispatch,
                            this.task.name,
                            event.toolCall.toolName,
                            event.toolCall.toolCallId,
                            toolEndError(event),
                        ),
                    );
                },
            });
            return {
                text: result.text,
                finishReason: result.finishReason,
                toolChoiceViolated: false,
                messages: [...messages, ...result.response.messages],
            };
        } catch (error) {
            if (!ToolChoiceViolationError.isInstance(error)) throw error;
            log.warn('Sub-agent called a tool after tools were closed', { agent: this.task.name });
            return {
                text: '',
                finishReason: 'tool-calls',
                toolChoiceViolated: true,
                messages: lastStepMessages,
            };
        }
    }

    /** A stopped run's late events would land in whatever the renderer shows next. */
    private progress(send: (dispatch: NonNullable<AgentContext['dispatch']>) => void): void {
        if (!this.ctx.dispatch || this.ctx.abortSignal?.aborted) return;
        send(this.ctx.dispatch);
    }

    private stats(): Pick<SubAgentResult, 'steps' | 'durationMs'> {
        return { steps: this.planner.plans.length, durationMs: Date.now() - this.startedAt };
    }

    private logFinish(result: SubAgentResult): void {
        const plans = this.planner.plans;
        log.info('Sub-agent finished', {
            agent: this.task.name,
            ...this.task.logContext,
            status: result.status,
            reason: result.reason ?? null,
            steps: result.steps,
            durationMs: result.durationMs,
            prunedSteps: plans.filter((plan) => plan.pruned).length,
            largestPromptTokens: Math.max(0, ...plans.map((plan) => plan.promptTokens)),
            reportChars: result.response.length,
        });
    }
}

/** One runner per chat run: its sub-agents share the parallel limit, and extra calls wait. */
export function createSubAgentRunner(ctx: AgentContext): SubAgentRunner {
    const limit = pLimit(MAX_PARALLEL_SUB_AGENTS);
    return (task) => {
        const run = new SubAgentRun(ctx, task);
        return limit(() => run.run());
    };
}
