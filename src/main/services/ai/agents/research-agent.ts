import { z } from 'zod';
import { buildBibleTools } from '../tools/bible.tools';
import { buildDocumentTools } from '../tools/document.tools';
import { buildSermonTools } from '../tools/sermon.tools';
import type { AiToolDefinition } from '../tools/types';
import type { AgentContext } from './types';
import { buildResearchAgentPrompt, buildResearchAgentTaskPrompt } from './agent-prompts';
import type { SubAgentRunner } from './run-sub-agent';

const AGENT_NAME = 'researchTopic';
const MAX_STEPS = 50;

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

export function buildResearchAgentTool(
    ctx: AgentContext,
    runSubAgent: SubAgentRunner,
): Record<string, AiToolDefinition> {
    return {
        researchTopic: {
            description:
                'Delegate a research task to a specialized subagent that searches across sermons, ' +
                'Bible passages, and documents. Use this for discovery or topic research: broad questions, ' +
                'subject studies, cross-references, comparisons, finding where a subject appears, or any ' +
                'answer that may require multiple sermons. It is responsible for finding and reading the ' +
                'relevant passages; do not call readSermon on multiple search matches for broad research. ' +
                'For follow-ups, pass prior findings in `alreadyKnown` and the new angle in `followUpGoal` ' +
                'so the subagent extends the research instead of repeating it. Returns a structured text ' +
                'research report with verified citations.',
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
            execute: ({ topic, description, alreadyKnown, followUpGoal, languageCode }) => {
                const lang = languageCode ?? ctx.contentLanguage;
                return runSubAgent({
                    name: AGENT_NAME,
                    label: 'Research',
                    instructions: buildResearchAgentPrompt(
                        lang,
                        ctx.uiLanguage,
                        ctx.activeBibleVersion,
                    ),
                    prompt: buildResearchAgentTaskPrompt({
                        topic,
                        description,
                        alreadyKnown,
                        followUpGoal,
                    }),
                    tools: buildResearchToolSubset(lang, ctx.activeBibleVersion),
                    maxSteps: MAX_STEPS,
                    logContext: { topic, description, languageCode: lang },
                });
            },
        },
    };
}
