import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiMessage } from '@shared/ai.types';

const getRecentMessagesMock = vi.fn();

vi.mock('@main/database/repositories/ai.repository', () => ({
    getRecentMessages: getRecentMessagesMock,
}));

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('tokenx', () => ({
    estimateTokenCount: (text: string) => Math.ceil(text.length / 4),
}));

const LARGE_BUDGET = 1_000_000;

function textMessage(
    id: string,
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
): AiMessage {
    return {
        id,
        conversationId,
        role,
        content,
        toolCalls: [],
        toolResults: [],
        createdAt: new Date().toISOString(),
    };
}

describe('context-memory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads only the most recent 40 messages from the repository', async () => {
        getRecentMessagesMock.mockReturnValue([]);

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        buildConversationContext('conv-0', LARGE_BUDGET);

        expect(getRecentMessagesMock).toHaveBeenCalledWith('conv-0', 40);
    });

    it('keeps markdown line structure in recent messages', async () => {
        const markdown = '# Titre\n\n- premier point\n- second point\n\nConclusion.';
        getRecentMessagesMock.mockReturnValue([
            textMessage('assistant-md', 'conv-md', 'assistant', markdown),
        ]);

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-md', LARGE_BUDGET);

        expect(context.recentMessages[0]?.content).toBe(markdown);
    });

    it('collapses repeated spacing without joining lines together', async () => {
        getRecentMessagesMock.mockReturnValue([
            textMessage('assistant-ws', 'conv-ws', 'assistant', 'Ligne   une  \n\n\n\nLigne deux'),
        ]);

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-ws', LARGE_BUDGET);

        expect(context.recentMessages[0]?.content).toBe('Ligne une\n\nLigne deux');
    });

    it('includes raw tool JSON for recent (non-compact) messages', async () => {
        const messages: AiMessage[] = [
            {
                id: 'assistant-1',
                conversationId: 'conv-1',
                role: 'assistant',
                content: 'Recherche terminee',
                toolCalls: [],
                toolResults: [
                    {
                        toolCallId: 'search-1',
                        name: 'searchContent',
                        output: {
                            results: [
                                { title: 'Titre 1', sermonId: '1' },
                                { title: 'Titre 2', sermonId: '2' },
                            ],
                            totalSermons: 120,
                            totalIsExact: false,
                            hasMore: true,
                        },
                    },
                ],
                createdAt: new Date().toISOString(),
            },
        ];

        getRecentMessagesMock.mockReturnValue(messages);

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-1', false);
        const recent = context.recentMessages[0]?.content ?? '';

        expect(recent).toContain('[Tool:searchContent]');
        expect(recent).toContain('Titre 1');
        expect(recent).toContain('Titre 2');
        expect(recent).toContain('"totalSermons":120');
        expect(recent).toContain('"hasMore":true');
        // nextCursor should be stripped
        expect(recent).not.toContain('nextCursor');
    });

    it('truncates full paragraph content in getSermonContent for recent messages', async () => {
        const messages: AiMessage[] = [
            {
                id: 'assistant-2',
                conversationId: 'conv-2',
                role: 'assistant',
                content: 'Voici le contenu',
                toolCalls: [],
                toolResults: [
                    {
                        toolCallId: 'content-1',
                        name: 'getSermonContent',
                        output: {
                            meta: { sermonId: '65-0429B', title: 'The Rapture', translationId: 3 },
                            paragraphs: [
                                { paragraphNumber: 0, content: 'X'.repeat(500) },
                                { paragraphNumber: 1, content: 'Y'.repeat(500) },
                            ],
                            totalParagraphs: 120,
                            startParagraph: 0,
                        },
                    },
                ],
                createdAt: new Date().toISOString(),
            },
        ];

        getRecentMessagesMock.mockReturnValue(messages);

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-2', false);
        const recent = context.recentMessages[0]?.content ?? '';

        expect(recent).toContain('[Tool:getSermonContent]');
        expect(recent).toContain('The Rapture');
        expect(recent).toContain('"paragraphNumber":0');
        // Full 500-char content should be truncated
        expect(recent).not.toContain('X'.repeat(500));
        expect(recent.length).toBeLessThan(1000);
    });

    /**
     * The summariser reads tool output by key off an untyped object, so a renamed output
     * field degrades the summary silently. These pin the keys each tool actually returns.
     */
    describe('summarizing tool results the way the tools return them', () => {
        function conversationWith(result: AiMessage['toolResults'][number]): AiMessage[] {
            const filler = Array.from({ length: 19 }, (_, index) =>
                textMessage(
                    `filler-${index}`,
                    'conv-tools',
                    index % 2 === 0 ? 'user' : 'assistant',
                    'x'.repeat(400),
                ),
            );
            return [
                {
                    id: 'tooled',
                    conversationId: 'conv-tools',
                    role: 'assistant',
                    content: 'Resultat',
                    toolCalls: [],
                    toolResults: [result],
                    createdAt: new Date().toISOString(),
                },
                ...filler,
            ];
        }

        async function summaryFor(result: AiMessage['toolResults'][number]): Promise<string> {
            getRecentMessagesMock.mockReturnValue(conversationWith(result));
            const { buildConversationContext } = await import('@main/services/ai/context-memory');
            return buildConversationContext('conv-tools', 500).summary ?? '';
        }

        it('lists the versions getBibleVersions returned', async () => {
            const summary = await summaryFor({
                toolCallId: 'versions-1',
                name: 'getBibleVersions',
                output: [
                    { bibleVersionAbbreviation: 'lsg', languageCode: 'fr', name: 'Louis Segond' },
                    { bibleVersionAbbreviation: 'kjv', languageCode: 'en', name: 'King James' },
                ],
            });

            expect(summary).toContain('2 Bible version(s): lsg, kjv');
            expect(summary).not.toContain('none');
        });

        it('names the subject getSubjectById returned', async () => {
            const summary = await summaryFor({
                toolCallId: 'subject-1',
                name: 'getSubjectById',
                output: {
                    subjectId: 'subject-1',
                    name: 'La foi',
                    documents: [{ referenceId: 'ref-1', documentTitle: 'Titre' }],
                },
            });

            expect(summary).toContain('Subject "La foi": 1 reference(s)');
        });

        it('names the subject createSubject returned even without a name', async () => {
            const summary = await summaryFor({
                toolCallId: 'subject-2',
                name: 'createSubject',
                output: { subjectId: 'subject-2' },
            });

            expect(summary).toContain('Created subject: subject-2');
        });
    });

    it('does not invent an empty field on subject references it passes through', async () => {
        getRecentMessagesMock.mockReturnValue([
            {
                id: 'assistant-subject',
                conversationId: 'conv-subject',
                role: 'assistant',
                content: 'Sujet',
                toolCalls: [],
                toolResults: [
                    {
                        toolCallId: 'subject-3',
                        name: 'getSubjectById',
                        output: {
                            subjectId: 'subject-3',
                            name: 'La foi',
                            documents: [{ referenceId: 'ref-1', documentTitle: 'Titre' }],
                        },
                    },
                ],
                createdAt: new Date().toISOString(),
            },
        ]);

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const recent = buildConversationContext('conv-subject', LARGE_BUDGET).recentMessages[0]
            ?.content;

        expect(recent).toContain('"documentTitle":"Titre"');
        expect(recent).not.toContain('textContent');
    });

    it('compacts older messages into summary when exceeding token budget', async () => {
        getRecentMessagesMock.mockReturnValue(buildLongConversation());

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-3', 3_000);

        expect(context.summary).not.toBeNull();
        expect(context.recentMessages.length).toBeGreaterThan(0);
        expect(context.recentMessages.length).toBeLessThan(20);
    });

    // Compacting frees only the difference, since the summary ships in the same request.
    it('charges the compacted summary against the same token budget', async () => {
        getRecentMessagesMock.mockReturnValue(buildLongConversation());

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-4', 3_000);

        expect(context.recentMessages).toHaveLength(8);
        expect(context.recentTokenCount).toBe(1_600);
        expect(context.historyTokenCount).toBe(4_000);
    });

    it('shrinks recent turns that overflow instead of sending them whole', async () => {
        getRecentMessagesMock.mockReturnValue(buildToolHeavyConversation());

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-heavy', 4_000);

        expect(context.recentTokenCount).toBeLessThanOrEqual(4_000);
        expect(context.recentMessages.length).toBeGreaterThan(0);
    });

    it('never shrinks the latest turn', async () => {
        getRecentMessagesMock.mockReturnValue(buildToolHeavyConversation());

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-heavy', 4_000);
        const latest = context.recentMessages[context.recentMessages.length - 1];

        expect(latest.content).toContain(LATEST_QUESTION);
    });

    // The pending assistant message is blank, so the question sits one entry before it.
    it('never shrinks the question when a pending assistant message trails it', async () => {
        getRecentMessagesMock.mockReturnValue([
            ...buildToolHeavyConversation(),
            textMessage('pending', 'conv-heavy', 'assistant', ''),
        ]);

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-heavy', 0);
        const latest = context.recentMessages[context.recentMessages.length - 1];

        expect(latest.content).toContain(LATEST_QUESTION);
    });

    it('keeps the minimum recent turns even with no budget left', async () => {
        getRecentMessagesMock.mockReturnValue(buildLongConversation());

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-5', 0);

        expect(context.recentMessages).toHaveLength(8);
        expect(context.summary).not.toBeNull();
    });
});

const LATEST_QUESTION =
    'Et que disait le prophete sur la foi qui deplace les montagnes, ' +
    'sur la priere qui persevere, et sur la maniere dont un pasteur doit ' +
    'preparer son coeur avant de monter en chaire le dimanche matin ? ' +
    "J'aimerais aussi comprendre le lien avec le bapteme du Saint-Esprit, " +
    'et comment presenter cela simplement a une assemblee qui debute dans la foi, ' +
    'sans employer de termes trop savants qui decourageraient les plus jeunes, ' +
    'tout en restant fidele a ce que la Parole enseigne sur ce sujet precis.';

function searchContentResult(index: number) {
    return {
        toolCallId: `tool-${index}`,
        name: 'searchContent',
        output: {
            results: Array.from({ length: 10 }, (_, hit) => ({
                sermonId: `6${hit}-0101`,
                translationId: 3,
                languageCode: 'fr',
                title: `Titre du sermon ${hit}`,
                matches: Array.from({ length: 5 }, (_, snippet) => ({
                    paragraphNumber: snippet,
                    snippet: 'Parole citée dans ce paragraphe. '.repeat(10),
                    wmbUrl: `wmb://sermon/6${hit}-0101/fr/3/${snippet}`,
                })),
                totalMatches: 5,
            })),
            totalSermons: 120,
            hasMore: true,
        },
    };
}

/** User turns are plain; every assistant turn carries a full search result, as in real use. */
function buildToolHeavyConversation(): AiMessage[] {
    return Array.from({ length: 21 }, (_, index) => {
        const isUser = index % 2 === 0;
        const isLatest = index === 20;
        return {
            id: `heavy-${index}`,
            conversationId: 'conv-heavy',
            role: isUser ? ('user' as const) : ('assistant' as const),
            content: isLatest ? LATEST_QUESTION : 'Message de la conversation.',
            toolCalls: [],
            toolResults: isUser ? [] : [searchContentResult(index)],
            createdAt: new Date().toISOString(),
        };
    });
}

function buildLongConversation(): AiMessage[] {
    return Array.from({ length: 20 }, (_, index) =>
        textMessage(
            `msg-${index}`,
            'conv-long',
            index % 2 === 0 ? 'user' : 'assistant',
            'A'.repeat(800),
        ),
    );
}
