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
        expect(prompt).toContain('extend the prior reading');
    });

    it('tells the research agent to broaden and vary queries', () => {
        const prompt = buildResearchAgentPrompt('fr', 'en', 'kjv');

        expect(prompt).toContain('Run multiple query variants');
        expect(prompt).toContain('Keep searching until novelty drops');
    });

    it('tells the sermon reader it may read more for whole-sermon tasks', () => {
        const prompt = buildSermonReaderAgentPrompt('fr', 'en', 'kjv');

        expect(prompt).toContain('whole-sermon summaries');
        expect(prompt).toContain('up to 8 pages (160 paragraphs)');
        expect(prompt).toContain('use searchSermons first');
    });
});
