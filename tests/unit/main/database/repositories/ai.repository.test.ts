import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as aiRepo from '@main/database/repositories/ai.repository';

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
            const byTitle = aiRepo.createConversation('en', 'Study on faith');
            const byMessage = aiRepo.createConversation('en', 'Untitled notes');
            const unrelated = aiRepo.createConversation('en', 'Something else');

            aiRepo.createMessage({
                conversationId: byMessage.id,
                role: 'user',
                content: 'tell me about faith and grace',
            });
            aiRepo.createMessage({
                conversationId: unrelated.id,
                role: 'user',
                content: 'a totally different topic',
            });

            return { byTitle, byMessage, unrelated };
        }

        it('matches on conversation title', () => {
            const { byTitle } = seed();
            const page = aiRepo.getConversationHistoryPage({ search: 'Study' });

            expect(page.conversations.map((c) => c.id)).toEqual([byTitle.id]);
            expect(page.totalCount).toBe(1);
        });

        it('matches on message content', () => {
            const { byMessage } = seed();
            const page = aiRepo.getConversationHistoryPage({ search: 'grace' });

            expect(page.conversations.map((c) => c.id)).toEqual([byMessage.id]);
        });

        it('matches title and message content together', () => {
            const { byTitle, byMessage, unrelated } = seed();
            const ids = aiRepo
                .getConversationHistoryPage({ search: 'faith' })
                .conversations.map((c) => c.id);

            expect(ids).toHaveLength(2);
            expect(ids).toEqual(expect.arrayContaining([byTitle.id, byMessage.id]));
            expect(ids).not.toContain(unrelated.id);
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

            const ids = [...first.conversations, ...second.conversations].map((c) => c.id);
            expect(new Set(ids).size).toBe(3);
        });

        it('returns an excerpt showing why a content-only hit matched', () => {
            const conv = aiRepo.createConversation('en', 'Untitled notes');
            aiRepo.createMessage({
                conversationId: conv.id,
                role: 'user',
                content: `${'padding '.repeat(30)}the baptism question${' trailing'.repeat(30)}`,
            });

            const page = aiRepo.getConversationHistoryPage({ search: 'baptism' });
            const excerpt = page.searchExcerpts?.[conv.id];

            expect(excerpt).toBeDefined();
            expect(excerpt).toContain('baptism');
            // Trimmed around the match rather than returning the whole message
            expect(excerpt!.length).toBeLessThan(200);
            expect(excerpt!.startsWith('…')).toBe(true);
            expect(excerpt!.endsWith('…')).toBe(true);
        });

        it('omits the excerpt when only the title matched', () => {
            const conv = aiRepo.createConversation('en', 'baptism study');
            aiRepo.createMessage({
                conversationId: conv.id,
                role: 'user',
                content: 'nothing relevant in here',
            });

            const page = aiRepo.getConversationHistoryPage({ search: 'baptism' });
            expect(page.conversations.map((c) => c.id)).toEqual([conv.id]);
            expect(page.searchExcerpts?.[conv.id]).toBeUndefined();
        });

        it.each([
            ['accents in stored text', 'Le baptême du Saint-Esprit', 'bapteme'],
            ['accents in the query', 'Le bapteme du Saint-Esprit', 'baptême'],
            ['case across accents', 'ÉGLISE de Dieu', 'église'],
            ['portuguese cedilla/tilde', 'Ação e reação', 'acao'],
            ['cyrillic case', 'Привет мир', 'ПРИВЕТ'],
            ['chinese substring', '我们讨论洗礼的意义', '洗礼'],
        ])('matches %s', (_label, content, query) => {
            const conv = aiRepo.createConversation('en', 'Untitled');
            aiRepo.createMessage({ conversationId: conv.id, role: 'user', content });

            const page = aiRepo.getConversationHistoryPage({ search: query });
            expect(page.conversations.map((c) => c.id)).toEqual([conv.id]);
        });

        it('keeps Japanese voiced marks distinct', () => {
            const conv = aiRepo.createConversation('en', 'だから');

            expect(
                aiRepo.getConversationHistoryPage({ search: 'だから' }).conversations,
            ).toHaveLength(1);
            expect(
                aiRepo.getConversationHistoryPage({ search: 'たから' }).conversations,
            ).toHaveLength(0);
            expect(conv.title).toBe('だから');
        });

        it('does not attach excerpts when not searching', () => {
            seed();
            expect(aiRepo.getConversationHistoryPage({}).searchExcerpts).toBeUndefined();
        });

        it('ignores search when the term is blank', () => {
            seed();
            const page = aiRepo.getConversationHistoryPage({ search: '   ' });
            expect(page.conversations).toHaveLength(3);
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
        it('ensureSettings creates defaults', () => {
            const settings = aiRepo.ensureSettings();
            expect(settings.enabled).toBe(false);
        });

        it('updateSettings merges partial', () => {
            aiRepo.ensureSettings();
            const updated = aiRepo.updateSettings({ enabled: true });
            expect(updated.enabled).toBe(true);
        });
    });
});
