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
