import { z } from 'zod';
import { buildSermonTools } from '../tools/sermon.tools';
import type { AiToolDefinition } from '../tools/types';
import type { AgentContext } from './types';
import { buildSermonReaderAgentPrompt, buildSermonReaderTaskPrompt } from './agent-prompts';
import type { SubAgentRunner } from './run-sub-agent';

const AGENT_NAME = 'readSermon';
const MAX_STEPS = 20;

function resolveSermonReaderQuestion(input: {
    question?: string;
    focus?: string;
    description?: string;
    sermonId?: string;
    sermonQuery?: string;
}): string {
    const explicitQuestion = input.question?.trim();
    if (explicitQuestion) {
        return explicitQuestion;
    }

    const focusedRequest = input.focus?.trim();
    if (focusedRequest) {
        return focusedRequest;
    }

    const describedRequest = input.description?.trim();
    if (describedRequest) {
        return describedRequest;
    }

    const sermonTarget = input.sermonId?.trim() || input.sermonQuery?.trim();
    if (sermonTarget) {
        return `Read the sermon "${sermonTarget}" and answer the user's latest request as faithfully as possible, matching the requested depth and using verified citations.`;
    }

    return "Read the sermon and answer the user's latest request as faithfully as possible, matching the requested depth and using verified citations.";
}

function buildSermonReaderToolSubset(languageCode: string): Record<string, AiToolDefinition> {
    const sermonTools = buildSermonTools(languageCode);

    return {
        searchSermons: sermonTools.searchSermons,
        getSermonContent: sermonTools.getSermonContent,
        searchContent: sermonTools.searchContent,
    };
}

export function buildSermonReaderAgentTool(
    ctx: AgentContext,
    runSubAgent: SubAgentRunner,
): Record<string, AiToolDefinition> {
    return {
        readSermon: {
            description:
                'Delegate sermon reading to a specialized subagent that paginates through sermon content ' +
                'and answers a question about one specific sermon. Use only when the user targets a single ' +
                'sermon or sermon-like hint and wants that sermon summarized, outlined, explained, quoted, ' +
                'or mined for Bible citations/key themes. Do not use this for broad topic research, subject ' +
                'discovery, or multiple search matches; use researchTopic instead because it finds and reads ' +
                'the relevant passages itself. For follow-ups, pass prior findings in `alreadyKnown` and the ' +
                'new angle in `focus` so the subagent goes deeper instead of repeating a general summary. ' +
                'Returns a structured answer with verified paragraph citations.',
            inputSchema: z
                .object({
                    sermonId: z.string().optional().describe('The sermon ID to read'),
                    sermonQuery: z
                        .string()
                        .optional()
                        .describe(
                            'A sermon title, date, or location hint to resolve first when the exact sermonId is unknown',
                        ),
                    translationId: z
                        .number()
                        .int()
                        .optional()
                        .describe('Translation ID from search results'),
                    startParagraph: z
                        .number()
                        .int()
                        .min(0)
                        .optional()
                        .describe(
                            'Optional 1-based paragraph number to start reading from in a follow-up',
                        ),
                    maxParagraphs: z
                        .number()
                        .int()
                        .min(1)
                        .max(50)
                        .optional()
                        .describe('Optional page size hint for sermon pagination (min 1, max 50)'),
                    question: z
                        .string()
                        .optional()
                        .describe('The question to answer about this sermon'),
                    description: z
                        .string()
                        .optional()
                        .describe(
                            'Additional context, desired output format, or hints about the relevant section',
                        ),
                    alreadyKnown: z
                        .string()
                        .optional()
                        .describe(
                            'Continuity hints from prior reading, so this follow-up can avoid repetition while re-checking important claims',
                        ),
                    focus: z
                        .string()
                        .optional()
                        .describe(
                            'Specific paragraph range, theme, citation request, or unresolved angle to focus on next',
                        ),
                    languageCode: z
                        .string()
                        .optional()
                        .describe('Language code for content (defaults to content language)'),
                })
                .refine((value) => Boolean(value.sermonId?.trim() || value.sermonQuery?.trim()), {
                    message: 'Provide sermonId or sermonQuery.',
                    path: ['sermonId'],
                }),
            execute: ({
                sermonId,
                sermonQuery,
                translationId,
                startParagraph,
                maxParagraphs,
                question,
                description,
                alreadyKnown,
                focus,
                languageCode,
            }) => {
                const lang = languageCode ?? ctx.contentLanguage;
                const normalizedSermonId = sermonId?.trim();
                const normalizedSermonQuery = sermonQuery?.trim();
                const resolvedQuestion = resolveSermonReaderQuestion({
                    question,
                    focus,
                    description,
                    sermonId: normalizedSermonId,
                    sermonQuery: normalizedSermonQuery,
                });
                return runSubAgent({
                    name: AGENT_NAME,
                    label: 'Sermon reading',
                    instructions: buildSermonReaderAgentPrompt(lang, ctx.uiLanguage),
                    prompt: buildSermonReaderTaskPrompt({
                        sermonId: normalizedSermonId,
                        sermonQuery: normalizedSermonQuery,
                        translationId,
                        startParagraph,
                        maxParagraphs,
                        question: resolvedQuestion,
                        description,
                        alreadyKnown,
                        focus,
                    }),
                    tools: buildSermonReaderToolSubset(lang),
                    maxSteps: MAX_STEPS,
                    logContext: {
                        sermonId: normalizedSermonId,
                        sermonQuery: normalizedSermonQuery,
                        question: resolvedQuestion,
                        languageCode: lang,
                    },
                });
            },
        },
    };
}
