import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import log from '@main/lib/logger';
import { buildSermonTools } from '../tools/sermon.tools';
import type { AiToolDefinition } from '../tools/types';
import type { AgentContext } from './types';
import { buildSermonReaderAgentPrompt, buildSermonReaderTaskPrompt } from './agent-prompts';
import { dispatchAgentToolStart, dispatchAgentToolComplete } from './agent-dispatcher';

const AGENT_NAME = 'readSermon';
const MAX_STEPS = 12;
const MAX_OUTPUT_TOKENS = 2000;

function buildSermonReaderToolSubset(languageCode: string): Record<string, AiToolDefinition> {
    const sermonTools = buildSermonTools(languageCode);

    return {
        getSermonContent: sermonTools.getSermonContent,
        searchContent: sermonTools.searchContent,
    };
}

export function buildSermonReaderAgentTool(ctx: AgentContext): Record<string, AiToolDefinition> {
    return {
        readSermon: {
            description:
                'Delegate sermon reading to a specialized subagent that paginates through sermon content ' +
                'and answers a specific question. Use this when the user asks to summarize, explain, or ' +
                'analyze a specific sermon. For follow-ups, pass prior findings in `alreadyKnown` and the ' +
                'new angle in `focus` or `description` so the subagent goes deeper instead of repeating a ' +
                'general summary. Returns a concise summary with paragraph citations.',
            inputSchema: z.object({
                sermonId: z.string().describe('The sermon ID to read'),
                translationId: z
                    .number()
                    .int()
                    .optional()
                    .describe('Translation ID from search results'),
                question: z.string().describe('The question to answer about this sermon'),
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
                        'What was already answered previously, so this follow-up can avoid repeating the same summary',
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
            }),
            execute: async ({
                sermonId,
                translationId,
                question,
                description,
                alreadyKnown,
                focus,
                languageCode,
            }) => {
                const lang = languageCode ?? ctx.contentLanguage;
                const executors = buildSermonReaderToolSubset(lang);
                const agentTools = Object.fromEntries(
                    Object.entries(executors).map(([name, def]) => [name, tool(def)]),
                );
                const prompt = buildSermonReaderTaskPrompt({
                    sermonId,
                    translationId,
                    question,
                    description,
                    alreadyKnown,
                    focus,
                });

                log.info('Sermon reader agent starting', {
                    sermonId,
                    question,
                    languageCode: lang,
                });

                try {
                    const result = await generateText({
                        model: ctx.model,
                        system: buildSermonReaderAgentPrompt(
                            lang,
                            ctx.uiLanguage,
                            ctx.activeBibleVersion,
                        ),
                        prompt,
                        tools: agentTools,
                        stopWhen: stepCountIs(MAX_STEPS),
                        maxOutputTokens: MAX_OUTPUT_TOKENS,
                        abortSignal: ctx.abortSignal,
                        experimental_onToolCallStart(event) {
                            if (ctx.dispatch) {
                                dispatchAgentToolStart(
                                    ctx.dispatch,
                                    AGENT_NAME,
                                    event.toolCall.toolName,
                                    event.toolCall.toolCallId,
                                    (event.toolCall.input as Record<string, unknown>) ?? {},
                                );
                            }
                        },
                        experimental_onToolCallFinish(event) {
                            if (ctx.dispatch) {
                                dispatchAgentToolComplete(
                                    ctx.dispatch,
                                    AGENT_NAME,
                                    event.toolCall.toolName,
                                    event.toolCall.toolCallId,
                                );
                            }
                        },
                    });

                    const truncated = result.finishReason === 'length';
                    if (truncated) {
                        log.warn('Sermon reader agent output truncated', { sermonId });
                    }

                    log.info('Sermon reader agent completed', {
                        sermonId,
                        steps: result.steps.length,
                        truncated,
                    });

                    return {
                        status: 'completed',
                        summary: truncated
                            ? `${result.text}\n\n[Sermon reading output was truncated due to length limit]`
                            : result.text,
                    };
                } catch (error) {
                    // Re-throw abort errors so the outer runner stops
                    if (ctx.abortSignal?.aborted) throw error;

                    const message =
                        error instanceof Error ? error.message : 'Sermon reader agent failed';

                    log.error('Sermon reader agent failed', { sermonId, error: message });
                    return {
                        status: 'failed',
                        summary: `Sermon reading failed: ${message}`,
                        error: message,
                    };
                }
            },
        },
    };
}
