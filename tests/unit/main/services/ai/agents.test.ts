import { describe, expect, it } from 'vitest';
import {
    buildResearchAgentPrompt,
    buildResearchAgentTaskPrompt,
    buildSermonReaderAgentPrompt,
    buildSermonReaderTaskPrompt,
} from '@main/services/ai/agents/agent-prompts';

describe('AI agents prompt builders', () => {
    it('builds follow-up-aware research prompts', () => {
        const prompt = buildResearchAgentTaskPrompt({
            topic: 'Revelation 10',
            description: 'The user wants the prophet references, not a doctrinal opinion.',
            alreadyKnown: 'Previous research found Rev 10:7 references in multiple sermons.',
            followUpGoal: 'Find what is said specifically about the mighty angel and open book.',
        });

        expect(prompt).toContain('Topic to investigate: Revelation 10');
        expect(prompt).toContain('Additional context:');
        expect(prompt).toContain('Already known from earlier research');
        expect(prompt).toContain('What to deepen, verify, or find next:');
        expect(prompt).toContain('prioritize new findings');
    });

    it('builds follow-up-aware sermon reader prompts', () => {
        const prompt = buildSermonReaderTaskPrompt({
            sermonId: '63-0318',
            translationId: 3,
            question: 'What is said about the opening of the Seals?',
            description: 'Answer with paragraph citations only.',
            alreadyKnown: 'The earlier answer already summarized the first section.',
            focus: 'Go deeper on the later paragraphs that connect Rev 10:1-7.',
        });

        expect(prompt).toContain('Sermon to read: 63-0318 (translationId: 3)');
        expect(prompt).toContain(
            'Question to answer: What is said about the opening of the Seals?',
        );
        expect(prompt).toContain('Additional context:');
        expect(prompt).toContain('Already known from prior reading');
        expect(prompt).toContain('What to focus on in this follow-up:');
        expect(prompt).toContain('extend prior reading');
    });

    it('tells the research agent to keep searching until it can answer, then stop', () => {
        const prompt = buildResearchAgentPrompt('fr', 'en', 'kjv');

        expect(prompt).toContain('Do not stop after one weak search');
        expect(prompt).toContain("run one more search with the prophet's own wording");
        expect(prompt).toContain('Stop once you can answer the topic from cited sources');
    });

    /** Depth without a stopping rule cost minutes per reply and bought nothing. */
    it('does not ask the research agent to search until the corpus runs dry', () => {
        const prompt = buildResearchAgentPrompt('fr', 'en', 'kjv');

        expect(prompt).not.toContain('One search is never enough');
        expect(prompt).not.toContain('sub-questions');
        expect(prompt).not.toContain('what would contradict');
    });

    it('keeps the search mechanics', () => {
        const prompt = buildResearchAgentPrompt('fr', 'en', 'kjv');

        expect(prompt).toContain('Extract 2-3 key content words');
        expect(prompt).toContain('mode "exact" first');
        expect(prompt).toContain('reuse `nextCursor`');
        expect(prompt).toContain('The index ignores accents');
    });

    it('tells the sermon reader it may read more for whole-sermon tasks', () => {
        const prompt = buildSermonReaderAgentPrompt('fr', 'en', 'kjv');

        expect(prompt).toContain('whole-sermon summaries');
        expect(prompt).toContain('up to 8 pages (160 paragraphs)');
        expect(prompt).toContain('use searchSermons first');
    });
});
