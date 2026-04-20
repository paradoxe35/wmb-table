import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import log from '@main/lib/logger';
import { buildBibleTools } from '../tools/bible.tools';
import { buildDocumentTools } from '../tools/document.tools';
import { buildSermonTools } from '../tools/sermon.tools';
import type { AiToolDefinition } from '../tools/types';
import type { AgentContext } from './types';
import { buildResearchAgentPrompt, buildResearchAgentTaskPrompt } from './agent-prompts';
import { dispatchAgentToolStart, dispatchAgentToolComplete } from './agent-dispatcher';

const AGENT_NAME = 'researchTopic';
const MAX_STEPS = 40;
const MAX_OUTPUT_TOKENS = 3000;

function buildResearchToolSubset(
    languageCode: string,
    bibleAbbreviation?: string,
): Record<string, AiToolDefinition> {
    const sermonTools = buildSermonTools(languageCode);
    const bibleTools = buildBibleTools(languageCode, bibleAbbreviation);
    const documentTools = buildDocumentTools();

    return {
        searchSermons: sermonTools.searchSermons,
        searchContent: sermonTools.searchContent,
        getSermonContent: sermonTools.getSermonContent,
        getBiblePassage: bibleTools.getBiblePassage,
        getBibleVersions: bibleTools.getBibleVersions,
        searchBible: bibleTools.searchBible,
        searchCustomDocuments: documentTools.searchCustomDocuments,
        getCustomDocuments: documentTools.getCustomDocuments,
        getCustomDocumentContent: documentTools.getCustomDocumentContent,
    };
}

export function buildResearchAgentTool(ctx: AgentContext): Record<string, AiToolDefinition> {
    return {
        researchTopic: {
            description:
                'Delegate a research task to a specialized subagent that searches across sermons, ' +
                'Bible passages, and documents. Use this for broad topic exploration, cross-referencing, ' +
                'or when the question requires reading multiple sources. For follow-ups, pass prior findings ' +
                'in `alreadyKnown` and the new angle in `followUpGoal` so the subagent extends the research ' +
                'instead of repeating it. Returns a structured text research report.',
            inputSchema: z.object({
                topic: z.string().describe('The research topic or question to investigate'),
                description: z
                    .string()
                    .optional()
                    .describe(
                        'Additional context, constraints, sermon hints, or the exact angle the user cares about',
                    ),
                alreadyKnown: z
                    .string()
                    .optional()
                    .describe(
                        'Continuity hints from prior research; use this to avoid repetition, but re-check any claim that matters',
                    ),
                followUpGoal: z
                    .string()
                    .optional()
                    .describe(
                        'What should be investigated next, verified more deeply, or clarified in this follow-up',
                    ),
                languageCode: z
                    .string()
                    .optional()
                    .describe('Language code for content search (defaults to content language)'),
            }),
            execute: async ({ topic, description, alreadyKnown, followUpGoal, languageCode }) => {
                const lang = languageCode ?? ctx.contentLanguage;
                const executors = buildResearchToolSubset(lang, ctx.activeBibleVersion);
                const agentTools = Object.fromEntries(
                    Object.entries(executors).map(([name, def]) => [name, tool(def)]),
                );
                const prompt = buildResearchAgentTaskPrompt({
                    topic,
                    description,
                    alreadyKnown,
                    followUpGoal,
                });

                log.info('Research agent starting', { topic, languageCode: lang });

                try {
                    const result = await generateText({
                        model: ctx.model,
                        system: buildResearchAgentPrompt(
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
                        log.warn('Research agent output truncated', { topic });
                    }

                    log.info('Research agent completed', {
                        topic,
                        steps: result.steps.length,
                        truncated,
                    });

                    return {
                        status: 'completed',
                        response: truncated
                            ? `${result.text}\n\n[Research output was truncated due to length limit]`
                            : result.text,
                    };
                } catch (error) {
                    // Re-throw abort errors so the outer runner stops
                    if (ctx.abortSignal?.aborted) throw error;

                    const message =
                        error instanceof Error ? error.message : 'Research agent failed';

                    log.error('Research agent failed', { topic, error: message });
                    return {
                        status: 'failed',
                        response: `Research failed: ${message}`,
                        error: message,
                    };
                }
            },
        },
    };
}
