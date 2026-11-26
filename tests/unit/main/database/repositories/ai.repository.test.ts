import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as aiRepo from '@main/database/repositories/ai.repository';
import { getDb } from '@main/database';
import { aiSettings } from '@main/database/schema';

describe('ai.repository', () => {
    beforeEach(() => {
        createTestDb();
    });

    describe('conversations', () => {
        it('createConversation and getConversation', () => {
            const conv = aiRepo.createConversation('en', 'Test Chat');
            expect(conv.title).toBe('Test Chat');

            const fetched = aiRepo.getConversation(conv.id);
            expect(fetched).not.toBeNull();
            expect(fetched!.title).toBe('Test Chat');
        });

        it('getConversations returns all ordered by updatedAt', () => {
            aiRepo.createConversation('en', 'First');
            aiRepo.createConversation('en', 'Second');
            const all = aiRepo.getConversations();
            expect(all).toHaveLength(2);
        });

        it('deleteConversation removes conversation and messages', () => {
            const conv = aiRepo.createConversation('en');
            aiRepo.createMessage({ conversationId: conv.id, role: 'user', content: 'Hello' });
            aiRepo.createMessage({ conversationId: conv.id, role: 'assistant', content: 'Hi' });

            aiRepo.deleteConversation(conv.id);
            expect(aiRepo.getConversation(conv.id)).toBeNull();
            expect(aiRepo.getMessages(conv.id)).toHaveLength(0);
        });

        it('clearAllConversations removes everything', () => {
            const c1 = aiRepo.createConversation('en');
            const c2 = aiRepo.createConversation('fr');
            aiRepo.createMessage({ conversationId: c1.id, role: 'user', content: 'A' });
            aiRepo.createMessage({ conversationId: c2.id, role: 'user', content: 'B' });

            aiRepo.clearAllConversations();
            expect(aiRepo.getConversations()).toHaveLength(0);
        });

        it('trimConversationHistory keeps only the N most recent', () => {
            for (let i = 0; i < 5; i++) {
                const conv = aiRepo.createConversation('en', `Conv ${i}`);
                aiRepo.createMessage({
                    conversationId: conv.id,
                    role: 'user',
                    content: `msg ${i}`,
                });
            }

            aiRepo.trimConversationHistory(2);
            const remaining = aiRepo.getConversations();
            expect(remaining).toHaveLength(2);
        });

        it('updateConversation updates title', () => {
            const conv = aiRepo.createConversation('en', 'Old');
            const updated = aiRepo.updateConversation(conv.id, { title: 'New' });
            expect(updated.title).toBe('New');
        });
    });

    describe('conversation search', () => {
        function seed() {
            const study = aiRepo.createConversation('en', 'Study on faith');
            const notes = aiRepo.createConversation('en', 'Untitled notes');
            const other = aiRepo.createConversation('en', 'Something else');
            return { study, notes, other };
        }

        it('matches on conversation title', () => {
            const { study } = seed();
            const page = aiRepo.getConversationHistoryPage({ search: 'Study' });

            expect(page.conversations.map((c) => c.id)).toEqual([study.id]);
            expect(page.totalCount).toBe(1);
        });

        it('ignores message content', () => {
            const conv = aiRepo.createConversation('en', 'Untitled');
            aiRepo.createMessage({
                conversationId: conv.id,
                role: 'user',
                content: 'tell me about grace',
            });

            expect(
                aiRepo.getConversationHistoryPage({ search: 'grace' }).conversations,
            ).toHaveLength(0);
        });

        it('returns an empty page when nothing matches', () => {
            seed();
            const page = aiRepo.getConversationHistoryPage({ search: 'zzz-no-match' });

            expect(page.conversations).toHaveLength(0);
            expect(page.totalCount).toBe(0);
            expect(page.hasMore).toBe(false);
        });

        it('treats LIKE wildcards as literal characters', () => {
            const literal = aiRepo.createConversation('en', '100% guaranteed');
            aiRepo.createConversation('en', 'no percent sign here');

            const page = aiRepo.getConversationHistoryPage({ search: '%' });
            expect(page.conversations.map((c) => c.id)).toEqual([literal.id]);
        });

        it('paginates search results', () => {
            for (let i = 0; i < 3; i += 1) {
                aiRepo.createConversation('en', `faith topic ${i}`);
            }

            const first = aiRepo.getConversationHistoryPage({ search: 'faith', limit: 2 });
            expect(first.conversations).toHaveLength(2);
            expect(first.hasMore).toBe(true);

            const second = aiRepo.getConversationHistoryPage({
                search: 'faith',
                limit: 2,
                loadedCount: first.loadedCount,
            });
            expect(second.conversations).toHaveLength(1);
            expect(second.hasMore).toBe(false);

            expect(
                new Set([...first.conversations, ...second.conversations].map((c) => c.id)).size,
            ).toBe(3);
        });

        it.each([
            ['accents in stored text', 'Le baptême du Saint-Esprit', 'bapteme'],
            ['accents in the query', 'Le bapteme du Saint-Esprit', 'baptême'],
            ['case across accents', 'ÉGLISE de Dieu', 'église'],
            ['portuguese cedilla/tilde', 'Ação e reação', 'acao'],
            ['cyrillic case', 'Привет мир', 'ПРИВЕТ'],
            ['chinese substring', '我们讨论洗礼的意义', '洗礼'],
        ])('matches %s', (_label, title, query) => {
            const conv = aiRepo.createConversation('en', title);
            const page = aiRepo.getConversationHistoryPage({ search: query });

            expect(page.conversations.map((c) => c.id)).toEqual([conv.id]);
        });

        it('keeps Japanese voiced marks distinct', () => {
            aiRepo.createConversation('en', 'だから');

            expect(
                aiRepo.getConversationHistoryPage({ search: 'だから' }).conversations,
            ).toHaveLength(1);
            expect(
                aiRepo.getConversationHistoryPage({ search: 'たから' }).conversations,
            ).toHaveLength(0);
        });

        it('ignores search when the term is blank', () => {
            seed();
            expect(aiRepo.getConversationHistoryPage({ search: '   ' }).conversations).toHaveLength(
                3,
            );
        });
    });

    describe('messages', () => {
        it('createMessage and getMessages', () => {
            const conv = aiRepo.createConversation('en');
            aiRepo.createMessage({ conversationId: conv.id, role: 'user', content: 'Hello' });
            aiRepo.createMessage({ conversationId: conv.id, role: 'assistant', content: 'Hi' });

            const msgs = aiRepo.getMessages(conv.id);
            expect(msgs).toHaveLength(2);
            expect(msgs[0].role).toBe('user');
            expect(msgs[1].role).toBe('assistant');
        });

        it('getRecentMessages returns limited results', () => {
            const conv = aiRepo.createConversation('en');
            for (let i = 0; i < 10; i++) {
                aiRepo.createMessage({
                    conversationId: conv.id,
                    role: 'user',
                    content: `msg ${i}`,
                });
            }

            const recent = aiRepo.getRecentMessages(conv.id, 3);
            expect(recent).toHaveLength(3);
        });

        it('getMessageHistoryPage returns the latest page first, then older messages', () => {
            const conv = aiRepo.createConversation('en');
            for (let i = 0; i < 10; i++) {
                aiRepo.createMessage({
                    conversationId: conv.id,
                    role: 'user',
                    content: `msg ${i + 1}`,
                });
            }

            const latestPage = aiRepo.getMessageHistoryPage({
                conversationId: conv.id,
                limit: 4,
                loadedCount: 0,
            });
            expect(latestPage.messages.map((message) => message.content)).toEqual([
                'msg 7',
                'msg 8',
                'msg 9',
                'msg 10',
            ]);
            expect(latestPage.loadedCount).toBe(4);
            expect(latestPage.hasMore).toBe(true);

            const olderPage = aiRepo.getMessageHistoryPage({
                conversationId: conv.id,
                limit: 4,
                loadedCount: latestPage.loadedCount,
            });
            expect(olderPage.messages.map((message) => message.content)).toEqual([
                'msg 3',
                'msg 4',
                'msg 5',
                'msg 6',
            ]);
            expect(olderPage.loadedCount).toBe(8);
            expect(olderPage.hasMore).toBe(true);
        });

        it('updateMessage changes content', () => {
            const conv = aiRepo.createConversation('en');
            const msg = aiRepo.createMessage({
                conversationId: conv.id,
                role: 'assistant',
                content: 'old',
            });
            const updated = aiRepo.updateMessage(msg.id, { content: 'new' });
            expect(updated.content).toBe('new');
        });
    });

    describe('settings', () => {
        it.each([0, -3, 1.5, 10_000])(
            'reads a bad stored history limit (%s) as a usable one',
            (stored) => {
                aiRepo.ensureSettings();
                getDb().update(aiSettings).set({ maxHistoryConversations: stored }).run();

                const limit = aiRepo.ensureSettings().maxHistoryConversations;
                expect(Number.isInteger(limit)).toBe(true);
                expect(limit).toBeGreaterThanOrEqual(1);
                expect(limit).toBeLessThanOrEqual(500);
            },
        );

        it('trimConversationHistory ignores a limit that is not a positive whole number', () => {
            aiRepo.createConversation('en', 'A');
            aiRepo.createConversation('en', 'B');

            aiRepo.trimConversationHistory(Number.NaN);
            aiRepo.trimConversationHistory(0);

            expect(aiRepo.getConversations()).toHaveLength(2);
        });

        it('ensureSettings creates defaults', () => {
            const settings = aiRepo.ensureSettings();
            expect(settings.enabled).toBe(true);
            expect(settings.activeProvider).toBeNull();
        });

        it('updateSettings merges partial', () => {
            aiRepo.ensureSettings();
            const updated = aiRepo.updateSettings({ enabled: false });
            expect(updated.enabled).toBe(false);
        });

        it('a provider update keeps the other fields and providers', () => {
            const current = aiRepo.ensureSettings();
            aiRepo.updateSettings({
                providers: {
                    ...current.providers,
                    gemini: { ...current.providers.gemini, apiKey: 'gm-key' },
                },
            });
            const updated = aiRepo.updateSettings({
                providers: { openai: { apiKey: 'oa-key' } } as never,
            });

            expect(updated.providers.gemini.apiKey).toBe('gm-key');
            expect(updated.providers.openai).toMatchObject({
                apiKey: 'oa-key',
                model: current.providers.openai.model,
            });
        });

        it('trims builtin API keys and base URLs, and drops blank ones', () => {
            const current = aiRepo.ensureSettings();
            const updated = aiRepo.updateSettings({
                providers: {
                    ...current.providers,
                    openai: { ...current.providers.openai, apiKey: '  sk-abc \n' },
                    ollama: { ...current.providers.ollama, apiKey: '   ', baseUrl: '  ' },
                },
            });

            expect(updated.providers.openai.apiKey).toBe('sk-abc');
            expect(updated.providers.ollama.apiKey).toBeUndefined();
            expect(updated.providers.ollama.baseUrl).toBeUndefined();
        });

        it('clears the active provider when its custom provider is deleted', () => {
            aiRepo.updateSettings({
                activeProvider: 'lm',
                customProviders: [
                    {
                        id: 'lm',
                        name: 'LM',
                        baseUrl: 'http://127.0.0.1:1234/v1',
                        defaultModel: 'm',
                    },
                ],
            });

            const updated = aiRepo.updateSettings({ customProviders: [] });

            expect(updated.customProviders).toEqual([]);
            expect(updated.activeProvider).toBeNull();
        });

        it('keeps a builtin active provider when custom providers change', () => {
            aiRepo.updateSettings({ activeProvider: 'ollama' });
            expect(aiRepo.updateSettings({ customProviders: [] }).activeProvider).toBe('ollama');
        });

        it('does not activate a custom provider that does not exist', () => {
            expect(aiRepo.updateSettings({ activeProvider: 'ghost' }).activeProvider).toBeNull();
        });
    });
});
