import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import log from '@main/lib/logger';
import { buildBibleTools } from '../tools/bible.tools';
import { buildDocumentTools } from '../tools/document.tools';
import { buildSermonTools } from '../tools/sermon.tools';
import type { AiToolDefinition } from '../tools/types';
import type { AgentContext } from './types';
import { buildResearchAgentPrompt } from './agent-prompts';
import { dispatchAgentToolStart, dispatchAgentToolComplete } from './agent-dispatcher';

const AGENT_NAME = 'researchTopic';
const MAX_STEPS = 12;
const MAX_OUTPUT_TOKENS = 2000;

function buildResearchToolSubset(languageCode: string): Record<string, AiToolDefinition> {
    const sermonTools = buildSermonTools(languageCode);
    const bibleTools = buildBibleTools(languageCode);
    const documentTools = buildDocumentTools();

    return {
        searchSermons: sermonTools.searchSermons,
        searchContent: sermonTools.searchContent,
        getSermonContent: sermonTools.getSermonContent,
        getBiblePassage: bibleTools.getBiblePassage,
        getBibleVersions: bibleTools.getBibleVersions,
        searchBible: bibleTools.searchBible,
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
                'or when the question requires reading multiple sources. Returns a concise summary.',
            inputSchema: z.object({
                topic: z.string().describe('The research topic or question to investigate'),
                languageCode: z
                    .string()
                    .optional()
                    .describe('Language code for content search (defaults to content language)'),
            }),
            execute: async ({ topic, languageCode }) => {
                const lang = languageCode ?? ctx.contentLanguage;
                const executors = buildResearchToolSubset(lang);
                const agentTools = Object.fromEntries(
                    Object.entries(executors).map(([name, def]) => [name, tool(def)]),
                );

                log.info('Research agent starting', { topic, languageCode: lang });

                try {
                    const result = await generateText({
                        model: ctx.model,
                        system: buildResearchAgentPrompt(lang, ctx.uiLanguage),
                        prompt: topic,
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

                    log.info('Research agent completed', {
                        topic,
                        steps: result.steps.length,
                    });

                    return { summary: result.text };
                } catch (error) {
                    // Re-throw abort errors so the outer runner stops
                    if (ctx.abortSignal?.aborted) throw error;

                    const message =
                        error instanceof Error ? error.message : 'Research agent failed';

                    log.error('Research agent failed', { topic, error: message });
                    return { summary: `Research failed: ${message}` };
                }
            },
        },
    };
}
