import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import log from '@main/lib/logger';
import { buildSermonTools } from '../tools/sermon.tools';
import type { AiToolDefinition } from '../tools/types';
import type { AgentContext } from './types';
import { buildSermonReaderAgentPrompt } from './agent-prompts';
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
                'analyze a specific sermon. Returns a concise summary with paragraph citations.',
            inputSchema: z.object({
                sermonId: z.string().describe('The sermon ID to read'),
                translationId: z
                    .number()
                    .int()
                    .optional()
                    .describe('Translation ID from search results'),
                question: z.string().describe('The question to answer about this sermon'),
                languageCode: z
                    .string()
                    .optional()
                    .describe('Language code for content (defaults to content language)'),
            }),
            execute: async ({ sermonId, translationId, question, languageCode }) => {
                const lang = languageCode ?? ctx.contentLanguage;
                const executors = buildSermonReaderToolSubset(lang);
                const agentTools = Object.fromEntries(
                    Object.entries(executors).map(([name, def]) => [name, tool(def)]),
                );

                const prompt = translationId
                    ? `Read sermon "${sermonId}" (translationId: ${translationId}) and answer: ${question}`
                    : `Read sermon "${sermonId}" and answer: ${question}`;

                log.info('Sermon reader agent starting', {
                    sermonId,
                    question,
                    languageCode: lang,
                });

                try {
                    const result = await generateText({
                        model: ctx.model,
                        system: buildSermonReaderAgentPrompt(lang, ctx.uiLanguage),
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

                    log.info('Sermon reader agent completed', {
                        sermonId,
                        steps: result.steps.length,
                    });

                    return {
                        summary: result.text,
                        sermonId,
                    };
                } catch (error) {
                    // Re-throw abort errors so the outer runner stops
                    if (ctx.abortSignal?.aborted) throw error;

                    const message =
                        error instanceof Error ? error.message : 'Sermon reader agent failed';

                    log.error('Sermon reader agent failed', { sermonId, error: message });
                    return { summary: `Sermon reading failed: ${message}`, sermonId };
                }
            },
        },
    };
}
