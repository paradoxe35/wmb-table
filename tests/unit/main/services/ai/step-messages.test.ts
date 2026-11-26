import { describe, expect, it } from 'vitest';
import type { ModelMessage } from 'ai';
import {
    condenseToolResults,
    shrinkMessages,
    withoutUnansweredToolCalls,
} from '@main/services/ai/runners/step-messages';

function toolExchange(id: string, query: string, output: unknown): ModelMessage[] {
    return [
        {
            role: 'assistant',
            content: [
                { type: 'reasoning', text: `Thinking about ${query}` },
                { type: 'tool-call', toolCallId: id, toolName: 'searchBible', input: { query } },
            ],
        },
        {
            role: 'tool',
            content: [
                {
                    type: 'tool-result',
                    toolCallId: id,
                    toolName: 'searchBible',
                    output: { type: 'json', value: output as never },
                },
            ],
        },
    ];
}

const bibleHits = (query: string) => ({
    query,
    total: 2,
    results: [
        { bookName: 'Genèse', chapter: '3', verse: '11', content: 'Qui t’a appris que tu es nu ?' },
        {
            bookName: 'Genèse',
            chapter: '3',
            verse: '10',
            content: 'J’ai eu peur, parce que je suis nu.',
        },
    ],
});

const conversation: ModelMessage[] = [
    { role: 'user', content: 'Qui t’a dit que tu étais nu ?' },
    ...toolExchange('c1', 'nu', bibleHits('nu')),
    ...toolExchange('c2', 'peur', bibleHits('peur')),
];

describe('condenseToolResults', () => {
    it('summarizes older results with their references and keeps the latest whole', () => {
        const condensed = condenseToolResults(conversation, 1);
        const [older, latest] = condensed.filter((message) => message.role === 'tool');

        expect(JSON.stringify(older)).toContain(
            '[Condensed earlier result] Bible search: 2 verse(s) for \\"nu\\": Genèse 3:11, Genèse 3:10',
        );
        expect(latest).toEqual(conversation[4]);
    });

    it('does not condense a result twice', () => {
        const once = condenseToolResults(conversation, 0);

        expect(condenseToolResults(once, 0)).toEqual(once);
    });
});

describe('shrinkMessages', () => {
    it('stops at the first stage that fits: old reasoning goes first', () => {
        const shrunk = shrinkMessages(
            conversation,
            (candidate) => !JSON.stringify(candidate).includes('Thinking about nu'),
        );

        expect(JSON.stringify(shrunk)).not.toContain('Thinking about');
        expect(JSON.stringify(shrunk)).not.toContain('[Condensed');
    });

    it('never touches the user question', () => {
        const shrunk = shrinkMessages(conversation, () => false);

        expect(shrunk[0]).toEqual(conversation[0]);
    });
});

describe('withoutUnansweredToolCalls', () => {
    it('drops a tool call that never got a result, and the message it leaves empty', () => {
        const cut: ModelMessage[] = [
            ...conversation,
            {
                role: 'assistant',
                content: [
                    { type: 'tool-call', toolCallId: 'c3', toolName: 'searchBible', input: {} },
                ],
            },
        ];

        expect(withoutUnansweredToolCalls(cut)).toEqual(conversation);
    });
});
