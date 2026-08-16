import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '@main/services/ai/system-prompt';

const baseInput = {
    contentLanguageCode: 'fr',
    uiLanguageCode: 'fr',
    installedLanguages: [],
    languagePreference: 'active' as const,
    activeBibleVersion: 'lsg',
};

describe('AI system prompt', () => {
    it('prioritizes subagents while keeping direct sermon tools available', () => {
        const prompt = buildSystemPrompt({ ...baseInput });

        expect(prompt).toContain('## Tool routing priority');
        expect(prompt).toContain('Use the subagents as the primary path');
        expect(prompt).toContain('For broad topic research, call **researchTopic** once');
        expect(prompt).toContain('Use direct sermon tools');
        expect(prompt).toContain('Use searchContent (full-text search)');
        expect(prompt).toContain('Use searchSermons only for metadata lookups');
    });

    it('tells models to use sermon titles as visible citation labels', () => {
        const prompt = buildSystemPrompt({ ...baseInput });

        expect(prompt).toContain(
            'The visible link label should use the human-readable sermon title from tool results, not the sermonId.',
        );
        expect(prompt).toContain('Bad: `[65-0801M, §133](...)`');
    });
});
