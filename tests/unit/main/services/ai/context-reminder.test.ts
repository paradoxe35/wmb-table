import { describe, expect, it } from 'vitest';
import {
    buildContextReminder,
    shouldInjectContextReminder,
    withContextReminder,
} from '@main/services/ai/context-reminder';

const SHORT_CONVERSATION = {
    compacted: false,
    promptTokens: 2_000,
    contextWindow: 128_000,
};

describe('shouldInjectContextReminder', () => {
    it('stays out of short conversations', () => {
        expect(shouldInjectContextReminder(SHORT_CONVERSATION)).toBe(false);
    });

    it('injects once older turns have been compacted', () => {
        expect(shouldInjectContextReminder({ ...SHORT_CONVERSATION, compacted: true })).toBe(true);
    });

    it('injects from half of the context window', () => {
        expect(
            shouldInjectContextReminder({
                ...SHORT_CONVERSATION,
                contextWindow: 32_000,
                promptTokens: 16_000,
            }),
        ).toBe(true);
    });

    it('injects on large histories even when the window is far from full', () => {
        expect(
            shouldInjectContextReminder({
                ...SHORT_CONVERSATION,
                contextWindow: 1_000_000,
                promptTokens: 20_000,
            }),
        ).toBe(true);
    });

    it('still injects when the context window is unknown', () => {
        expect(
            shouldInjectContextReminder({
                ...SHORT_CONVERSATION,
                contextWindow: undefined,
                promptTokens: 40_000,
            }),
        ).toBe(true);
    });
});

describe('buildContextReminder', () => {
    it('re-anchors tool use, citations and formatting', () => {
        const reminder = buildContextReminder();

        expect(reminder).toContain('<system-reminder>');
        expect(reminder).toContain('</system-reminder>');
        expect(reminder).toContain('Call tools');
        expect(reminder).toContain('wmb://');
        expect(reminder).toContain('markdown');
    });

    it('points back at the subagents', () => {
        expect(buildContextReminder()).toContain('researchTopic');
        expect(buildContextReminder()).toContain('readSermon');
    });
});

describe('withContextReminder', () => {
    it('appends to the last user turn instead of adding a message', () => {
        const history = [
            { role: 'user' as const, content: 'first question' },
            { role: 'assistant' as const, content: 'first answer' },
            { role: 'user' as const, content: 'second question' },
        ];

        const result = withContextReminder(
            history,
            '<system-reminder>stay on task</system-reminder>',
        );

        expect(result).toHaveLength(3);
        expect(result[2].role).toBe('user');
        expect(result[2].content).toContain('second question');
        expect(result[2].content).toContain('stay on task');
        expect(result[1].content).toBe('first answer');
    });

    it('does not mutate the history it was given', () => {
        const history = [{ role: 'user' as const, content: 'question' }];

        withContextReminder(history, 'reminder');

        expect(history[0].content).toBe('question');
    });

    it('adds a user turn when the history has none', () => {
        const history = [{ role: 'assistant' as const, content: 'answer' }];

        const result = withContextReminder(history, 'reminder');

        expect(result).toHaveLength(2);
        expect(result[1]).toEqual({ role: 'user', content: 'reminder' });
    });
});
