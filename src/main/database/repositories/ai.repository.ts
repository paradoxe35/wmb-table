import { asc, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { aiConversations, aiMessages, aiSettings } from '../schema';
import { logChange } from '@main/services/sync/change-log.service';
import {
    BUILTIN_PROVIDER_IDS,
    createDefaultAiSettings,
    type AiConversation,
    type AiMessage,
    type AiMessageRole,
    type AiProviders,
    type AiSettings,
    type AiToolCall,
    type AiToolResult,
} from '@shared/ai.types';

const AI_SETTINGS_ID = 'ai_settings';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function toConversation(row: typeof aiConversations.$inferSelect): AiConversation {
    return {
        id: row.id,
        title: row.title,
        languageCode: row.languageCode,
        summary: row.summary,
        createdAt: row.createdAt ?? new Date().toISOString(),
        updatedAt: row.updatedAt ?? new Date().toISOString(),
    };
}

function toMessage(row: typeof aiMessages.$inferSelect): AiMessage {
    return {
        id: row.id,
        conversationId: row.conversationId,
        role: row.role as AiMessageRole,
        content: row.content,
        toolCalls: parseJson<AiToolCall[]>(row.toolCalls, []),
        toolResults: parseJson<AiToolResult[]>(row.toolResults, []),
        createdAt: row.createdAt ?? new Date().toISOString(),
    };
}

function rowToSettings(row: typeof aiSettings.$inferSelect): AiSettings {
    const defaults = createDefaultAiSettings();
    return {
        enabled: row.enabled,
        activeProvider: row.activeProvider,
        activeModel: row.activeModel,
        languagePreference: row.languagePreference as AiSettings['languagePreference'],
        maxHistoryConversations: row.maxHistoryConversations,
        maxContextMessages: row.maxContextMessages,
        providers: {
            ...defaults.providers,
            ...parseJson<AiProviders>(row.providers, defaults.providers),
        },
        customProviders: parseJson(row.customProviders, defaults.customProviders),
    };
}

// ── Settings ──

export function getSettings(): AiSettings | null {
    const row = getDb().select().from(aiSettings).where(eq(aiSettings.id, AI_SETTINGS_ID)).get();
    return row ? rowToSettings(row) : null;
}

export function ensureSettings(): AiSettings {
    const current = getSettings();
    if (current) return current;

    const defaults = createDefaultAiSettings();
    getDb()
        .insert(aiSettings)
        .values({
            id: AI_SETTINGS_ID,
            enabled: defaults.enabled,
            activeProvider: defaults.activeProvider,
            activeModel: defaults.activeModel,
            languagePreference: defaults.languagePreference,
            maxHistoryConversations: defaults.maxHistoryConversations,
            maxContextMessages: defaults.maxContextMessages,
            providers: JSON.stringify(defaults.providers),
            customProviders: JSON.stringify(defaults.customProviders),
        })
        .run();

    return getSettings()!;
}

function mergeProviders(current: AiProviders, partial: Partial<AiProviders>): AiProviders {
    const result = {} as AiProviders;
    for (const id of BUILTIN_PROVIDER_IDS) {
        result[id] = partial[id] ? { ...current[id], ...partial[id] } : current[id];
    }
    return result;
}

export function updateSettings(partial: Partial<AiSettings>): AiSettings {
    const current = ensureSettings();
    const mergedProviders = partial.providers
        ? mergeProviders(current.providers, partial.providers as Partial<AiProviders>)
        : current.providers;

    getDb()
        .update(aiSettings)
        .set({
            enabled: partial.enabled ?? current.enabled,
            activeProvider: partial.activeProvider ?? current.activeProvider,
            activeModel: partial.activeModel ?? current.activeModel,
            languagePreference: partial.languagePreference ?? current.languagePreference,
            maxHistoryConversations:
                partial.maxHistoryConversations ?? current.maxHistoryConversations,
            maxContextMessages: partial.maxContextMessages ?? current.maxContextMessages,
            providers: JSON.stringify(mergedProviders),
            customProviders: JSON.stringify(partial.customProviders ?? current.customProviders),
            updatedAt: new Date().toISOString(),
        })
        .where(eq(aiSettings.id, AI_SETTINGS_ID))
        .run();

    return ensureSettings();
}

// ── Conversations ──

export function getConversations(): AiConversation[] {
    return getDb()
        .select()
        .from(aiConversations)
        .orderBy(desc(aiConversations.updatedAt))
        .all()
        .map(toConversation);
}

export function getConversation(conversationId: string): AiConversation | null {
    const row = getDb()
        .select()
        .from(aiConversations)
        .where(eq(aiConversations.id, conversationId))
        .get();
    return row ? toConversation(row) : null;
}

export function createConversation(languageCode: string, title?: string): AiConversation {
    const id = randomUUID();
    const now = new Date().toISOString();
    getDb()
        .insert(aiConversations)
        .values({
            id,
            title: title ?? null,
            languageCode,
            summary: null,
            createdAt: now,
            updatedAt: now,
        })
        .run();
    const row = getDb().select().from(aiConversations).where(eq(aiConversations.id, id)).get();
    if (row) logChange('ai_conversations', id, 'SAVE', row);
    return getConversation(id)!;
}

export function updateConversation(
    conversationId: string,
    partial: Pick<Partial<AiConversation>, 'title' | 'summary' | 'languageCode'>,
): AiConversation {
    getDb()
        .update(aiConversations)
        .set({ ...partial, updatedAt: new Date().toISOString() })
        .where(eq(aiConversations.id, conversationId))
        .run();
    const row = getDb()
        .select()
        .from(aiConversations)
        .where(eq(aiConversations.id, conversationId))
        .get();
    if (row) logChange('ai_conversations', conversationId, 'SAVE', row);
    return getConversation(conversationId)!;
}

export function touchConversation(conversationId: string): void {
    getDb()
        .update(aiConversations)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(aiConversations.id, conversationId))
        .run();
}

export function deleteConversation(conversationId: string): void {
    // Log message deletions before cascade removes them
    const messages = getDb()
        .select({ id: aiMessages.id })
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, conversationId))
        .all();
    for (const msg of messages) {
        logChange('ai_messages', msg.id, 'DELETE', { id: msg.id });
    }
    getDb().delete(aiConversations).where(eq(aiConversations.id, conversationId)).run();
    logChange('ai_conversations', conversationId, 'DELETE', { id: conversationId });
}

export function clearAllConversations(): void {
    // Log all deletions before wiping
    const conversations = getDb().select({ id: aiConversations.id }).from(aiConversations).all();
    const messages = getDb().select({ id: aiMessages.id }).from(aiMessages).all();
    for (const msg of messages) {
        logChange('ai_messages', msg.id, 'DELETE', { id: msg.id });
    }
    for (const conv of conversations) {
        logChange('ai_conversations', conv.id, 'DELETE', { id: conv.id });
    }
    getDb().delete(aiConversations).run();
}

export function trimConversationHistory(limit: number): void {
    const rows = getDb()
        .select({ id: aiConversations.id })
        .from(aiConversations)
        .orderBy(desc(aiConversations.updatedAt))
        .all();
    for (const row of rows.slice(limit)) {
        deleteConversation(row.id);
    }
}

// ── Messages ──

export function getMessages(conversationId: string): AiMessage[] {
    return getDb()
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, conversationId))
        .orderBy(asc(aiMessages.createdAt))
        .all()
        .map(toMessage);
}

export function getMessage(messageId: string): AiMessage | null {
    const row = getDb().select().from(aiMessages).where(eq(aiMessages.id, messageId)).get();
    return row ? toMessage(row) : null;
}

export function createMessage(input: {
    conversationId: string;
    role: AiMessageRole;
    content?: string;
    toolCalls?: AiToolCall[];
    toolResults?: AiToolResult[];
}): AiMessage {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    getDb()
        .insert(aiMessages)
        .values({
            id,
            conversationId: input.conversationId,
            role: input.role,
            content: input.content ?? '',
            toolCalls: JSON.stringify(input.toolCalls ?? []),
            toolResults: JSON.stringify(input.toolResults ?? []),
            createdAt,
        })
        .run();
    touchConversation(input.conversationId);
    // Only log user messages immediately; assistant messages are logged via syncMessage() after streaming
    if (input.role === 'user') {
        const row = getDb().select().from(aiMessages).where(eq(aiMessages.id, id)).get();
        if (row) logChange('ai_messages', id, 'SAVE', row);
    }
    return getMessage(id)!;
}

export function updateMessage(
    messageId: string,
    partial: Pick<Partial<AiMessage>, 'content' | 'toolCalls' | 'toolResults'>,
): AiMessage {
    const current = getMessage(messageId);
    if (!current) {
        throw new Error(`AI message not found: ${messageId}`);
    }

    getDb()
        .update(aiMessages)
        .set({
            content: partial.content ?? current.content,
            toolCalls: JSON.stringify(partial.toolCalls ?? current.toolCalls),
            toolResults: JSON.stringify(partial.toolResults ?? current.toolResults),
        })
        .where(eq(aiMessages.id, messageId))
        .run();

    touchConversation(current.conversationId);
    return getMessage(messageId)!;
}

export function appendAssistantContent(messageId: string, delta: string): AiMessage {
    const current = getMessage(messageId);
    if (!current) {
        throw new Error(`AI message not found: ${messageId}`);
    }
    return updateMessage(messageId, { content: `${current.content}${delta}` });
}

export function setAssistantToolCalls(messageId: string, toolCalls: AiToolCall[]): AiMessage {
    return updateMessage(messageId, { toolCalls });
}

export function addAssistantToolResult(messageId: string, toolResult: AiToolResult): AiMessage {
    const current = getMessage(messageId);
    if (!current) {
        throw new Error(`AI message not found: ${messageId}`);
    }
    return updateMessage(messageId, { toolResults: [...current.toolResults, toolResult] });
}

/**
 * Log the final state of an assistant message for sync.
 * Call once after streaming is complete to avoid flooding the change log during generation.
 */
export function syncMessage(messageId: string): void {
    const row = getDb().select().from(aiMessages).where(eq(aiMessages.id, messageId)).get();
    if (row) logChange('ai_messages', messageId, 'SAVE', row);
}
