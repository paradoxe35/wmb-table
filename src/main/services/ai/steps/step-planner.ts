import type { ModelMessage, PrepareStepResult, StepResult, ToolSet } from 'ai';
import {
    canFitToolRound,
    resolveStepOutputTokens,
    type RunBudget,
    type StepPhase,
} from '../token-budget';
import { estimateMessagesTokens, shrinkMessages } from './step-messages';

export type FinalStepReason = 'step-limit' | 'context' | 'time-limit';

/** How a pass of the loop may use tools: freely, or only to write the answer. */
export type PassMode = 'research' | 'answer' | 'answer-without-tools';

const FINAL_ANSWER_NOTE = [
    '<system-reminder>',
    'The research phase is over: no more tool calls are possible in this reply.',
    'Write the complete final answer now, from the tool results above, in the language the instructions ask for, with the citations you already have.',
    'If something could not be checked, say so in one short sentence instead of searching.',
    '</system-reminder>',
].join('\n');

/** Provider token counts are trusted only to raise the estimate, never to lower it. */
const MAX_CALIBRATION = 3;

export interface StepPlannerOptions {
    budget: RunBudget;
    fixedPromptTokens: number;
    systemPrompt: string;
    maxSteps: number;
    reasoningControl: boolean;
    /** Replaces the main chat's "write the final answer" reminder on the answer-only step. */
    finalStepNote?: string;
    /** Epoch ms after which research stops so the answer is still written in time. */
    wrapUpAt?: number;
}

export interface StepPlan {
    stepNumber: number;
    promptTokens: number;
    maxOutputTokens: number;
    phase: StepPhase;
    pruned: boolean;
}

interface PrepareStepInput {
    stepNumber: number;
    steps: StepResult<ToolSet>[];
    messages: ModelMessage[];
}

export class StepPlanner {
    readonly plans: StepPlan[] = [];
    finalStepReason: FinalStepReason | null = null;
    private calibration = 1;
    private passRawEstimates = new Map<number, number>();

    constructor(private readonly options: StepPlannerOptions) {}

    startPass(): void {
        this.passRawEstimates = new Map();
    }

    prepareStep(mode: PassMode, input: PrepareStepInput): PrepareStepResult<ToolSet> {
        this.calibrate(input.steps);
        const { budget } = this.options;
        const measure = (messages: ModelMessage[]) =>
            Math.ceil(this.rawEstimate(messages) * this.calibration);

        const target =
            mode === 'research' && !this.isLastStep(input.stepNumber)
                ? budget.promptLimit - budget.toolRoundTokens
                : budget.promptLimit;
        const messages =
            measure(input.messages) > target
                ? shrinkMessages(input.messages, (candidate) => measure(candidate) <= target)
                : input.messages;
        const pruned = messages !== input.messages;
        const promptTokens = measure(messages);
        this.passRawEstimates.set(input.stepNumber, this.rawEstimate(messages));

        const phase = this.resolvePhase(mode, input.stepNumber, promptTokens);
        const maxOutputTokens = resolveStepOutputTokens(budget, promptTokens, phase);
        this.plans.push({
            stepNumber: input.stepNumber,
            promptTokens,
            maxOutputTokens,
            phase,
            pruned,
        });

        return {
            ...(pruned ? { messages } : {}),
            maxOutputTokens,
            ...(this.options.reasoningControl
                ? { reasoning: phase === 'answer' ? 'medium' : 'low' }
                : {}),
            ...(phase === 'answer' ? this.answerOnlySettings(mode) : {}),
        };
    }

    private answerOnlySettings(mode: PassMode): PrepareStepResult<ToolSet> {
        return {
            instructions: `${this.options.systemPrompt}\n\n${this.options.finalStepNote ?? FINAL_ANSWER_NOTE}`,
            ...(mode === 'answer-without-tools' ? { activeTools: [] } : { toolChoice: 'none' }),
        };
    }

    private resolvePhase(mode: PassMode, stepNumber: number, promptTokens: number): StepPhase {
        if (mode !== 'research') return 'answer';
        if (this.isLastStep(stepNumber)) {
            this.finalStepReason = 'step-limit';
            return 'answer';
        }
        if (!canFitToolRound(this.options.budget, promptTokens)) {
            this.finalStepReason = 'context';
            return 'answer';
        }
        if (this.options.wrapUpAt != null && Date.now() >= this.options.wrapUpAt) {
            this.finalStepReason = 'time-limit';
            return 'answer';
        }
        return 'research';
    }

    private isLastStep(stepNumber: number): boolean {
        return stepNumber >= this.options.maxSteps - 1;
    }

    private rawEstimate(messages: ModelMessage[]): number {
        return this.options.fixedPromptTokens + estimateMessagesTokens(messages);
    }

    private calibrate(steps: StepResult<ToolSet>[]): void {
        const lastIndex = steps.length - 1;
        const reported = steps[lastIndex]?.usage.inputTokens;
        const estimated = this.passRawEstimates.get(lastIndex);
        if (!reported || !estimated) return;
        this.calibration = Math.min(
            MAX_CALIBRATION,
            Math.max(this.calibration, reported / estimated),
        );
    }
}
