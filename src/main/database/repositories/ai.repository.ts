import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { aiConversations, aiMessages, aiSettings } from '../schema';
import { parseJsonOrFallback } from '@main/lib/json';
import { logChange } from '@main/services/sync/change-log.service';
import {
    AI_CONVERSATION_HISTORY_PAGE_SIZE,
    BUILTIN_PROVIDER_IDS,
    AI_MESSAGE_HISTORY_PAGE_SIZE,
    createDefaultAiSettings,
    type AiConversation,
    type AiConversationHistoryPage,
    type AiConversationHistoryPageRequest,
    type AiMessageHistoryPage,
    type AiMessageHistoryPageRequest,
    type AiMessage,
    type AiMessageRole,
    type AiProviders,
    type AiSettings,
    type AiToolCall,
    type AiToolResult,
} from '@shared/ai.types';

const AI_SETTINGS_ID = 'ai_settings';
function toConversation(row: typeof aiConversations.$inferSelect): AiConversation {
    return {
        id: row.id,
        title: row.title,
        summary: row.summary,
        aiTitle: row.aiTitle === 1,
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
        toolCalls: parseJsonOrFallback<AiToolCall[]>(row.toolCalls, [], {
            scope: 'ai_messages',
            field: 'tool_calls',
        }),
        toolResults: parseJsonOrFallback<AiToolResult[]>(row.toolResults, [], {
            scope: 'ai_messages',
            field: 'tool_results',
        }),
        createdAt: row.createdAt ?? new Date().toISOString(),
    };
}

function rowToSettings(row: typeof aiSettings.$inferSelect): AiSettings {
    const defaults = createDefaultAiSettings();
    return {
        enabled: row.enabled,
        activeProvider: row.activeProvider,
        languagePreference: row.languagePreference as AiSettings['languagePreference'],
        maxHistoryConversations: row.maxHistoryConversations,
        providers: {
            ...defaults.providers,
            ...parseJsonOrFallback<AiProviders>(row.providers, defaults.providers, {
                scope: 'ai_settings',
                field: 'providers',
            }),
        },
        customProviders: parseJsonOrFallback(row.customProviders, defaults.customProviders, {
            scope: 'ai_settings',
            field: 'custom_providers',
        }),
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
            languagePreference: defaults.languagePreference,
            maxHistoryConversations: defaults.maxHistoryConversations,
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
            activeProvider:
                'activeProvider' in partial ? partial.activeProvider : current.activeProvider,
            languagePreference: partial.languagePreference ?? current.languagePreference,
            maxHistoryConversations:
                partial.maxHistoryConversations ?? current.maxHistoryConversations,
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

/** Escapes LIKE wildcards so a user typing "%" searches for a literal "%" */
function toLikePattern(term: string): string {
    return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Title match, or any message in the conversation containing the term */
function conversationSearchCondition(search: string) {
    const pattern = toLikePattern(search);
    return sql`(
        ${aiConversations.title} LIKE ${pattern} ESCAPE '\\'
        OR EXISTS (
            SELECT 1 FROM ${aiMessages}
            WHERE ${aiMessages.conversationId} = ${aiConversations.id}
              AND ${aiMessages.content} LIKE ${pattern} ESCAPE '\\'
        )
    )`;
}

export function getConversationHistoryPage(
    input: AiConversationHistoryPageRequest,
): AiConversationHistoryPage {
    const limit = Math.max(1, input.limit ?? AI_CONVERSATION_HISTORY_PAGE_SIZE);
    const loadedCount = Math.max(0, input.loadedCount ?? 0);
    const search = input.search?.trim() ?? '';
    const condition = search ? conversationSearchCondition(search) : undefined;

    const totalCountRow = getDb()
        .select({ count: sql<number>`count(*)` })
        .from(aiConversations)
        .where(condition)
        .get();

    const totalCount = Number(totalCountRow?.count ?? 0);
    const pageSize = Math.min(limit, Math.max(totalCount - loadedCount, 0));

    const conversations =
        pageSize === 0
            ? []
            : getDb()
                  .select()
                  .from(aiConversations)
                  .where(condition)
                  .orderBy(desc(aiConversations.updatedAt))
                  .limit(pageSize)
                  .offset(loadedCount)
                  .all()
                  .map(toConversation);

    return {
        conversations,
        loadedCount: loadedCount + conversations.length,
        totalCount,
        hasMore: loadedCount + conversations.length < totalCount,
    };
}

export function getConversation(conversationId: string): AiConversation | null {
    const row = getDb()
        .select()
        .from(aiConversations)
        .where(eq(aiConversations.id, conversationId))
        .get();
    return row ? toConversation(row) : null;
}

function logConversationChange(conversationId: string): void {
    const row = getDb()
        .select()
        .from(aiConversations)
        .where(eq(aiConversations.id, conversationId))
        .get();
    if (row) logChange('ai_conversations', conversationId, 'SAVE', row);
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

    logConversationChange(id);

    return getConversation(id)!;
}

export function updateConversation(
    conversationId: string,
    partial: Pick<Partial<AiConversation>, 'title' | 'summary' | 'aiTitle'>,
): AiConversation {
    const { aiTitle, ...rest } = partial;
    getDb()
        .update(aiConversations)
        .set({
            ...rest,
            ...(aiTitle !== undefined ? { aiTitle: aiTitle ? 1 : 0 } : {}),
            updatedAt: new Date().toISOString(),
        })
        .where(eq(aiConversations.id, conversationId))
        .run();
    logConversationChange(conversationId);
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

    const toRemove = rows.slice(limit);
    if (toRemove.length === 0) return;

    const convIds = toRemove.map((r) => r.id);

    // Batch fetch message IDs for logging
    const messages = getDb()
        .select({ id: aiMessages.id })
        .from(aiMessages)
        .where(inArray(aiMessages.conversationId, convIds))
        .all();
    for (const msg of messages) {
        logChange('ai_messages', msg.id, 'DELETE', { id: msg.id });
    }
    for (const conv of toRemove) {
        logChange('ai_conversations', conv.id, 'DELETE', { id: conv.id });
    }

    // Cascade delete handles messages automatically
    getDb().delete(aiConversations).where(inArray(aiConversations.id, convIds)).run();
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

/** Load only the most recent N messages (ordered oldest→newest). */
export function getRecentMessages(conversationId: string, limit: number): AiMessage[] {
    const rows = getDb()
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, conversationId))
        .orderBy(desc(aiMessages.createdAt))
        .limit(limit)
        .all();
    return rows.reverse().map(toMessage);
}

export function getMessageHistoryPage(input: AiMessageHistoryPageRequest): AiMessageHistoryPage {
    const limit = Math.max(1, input.limit ?? AI_MESSAGE_HISTORY_PAGE_SIZE);
    const loadedCount = Math.max(0, input.loadedCount ?? 0);
    const totalCountRow = getDb()
        .select({ count: sql<number>`count(*)` })
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, input.conversationId))
        .get();
    const totalCount = Number(totalCountRow?.count ?? 0);
    const remainingOlderCount = Math.max(totalCount - loadedCount, 0);
    const pageSize = Math.min(limit, remainingOlderCount);
    const startOffset = Math.max(totalCount - loadedCount - pageSize, 0);

    const messages =
        pageSize === 0
            ? []
            : getDb()
                  .select()
                  .from(aiMessages)
                  .where(eq(aiMessages.conversationId, input.conversationId))
                  .orderBy(asc(aiMessages.createdAt))
                  .limit(pageSize)
                  .offset(startOffset)
                  .all()
                  .map(toMessage);

    return {
        messages,
        loadedCount: loadedCount + messages.length,
        totalCount,
        hasMore: startOffset > 0,
    };
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
    logConversationChange(input.conversationId);
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
    options?: { touchConversation?: boolean },
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

    if (options?.touchConversation !== false) {
        touchConversation(current.conversationId);
    }

    return getMessage(messageId)!;
}

export function appendAssistantContent(messageId: string, delta: string): void {
    const row = getDb()
        .select({ conversationId: aiMessages.conversationId })
        .from(aiMessages)
        .where(eq(aiMessages.id, messageId))
        .get();
    if (!row) {
        throw new Error(`AI message not found: ${messageId}`);
    }

    getDb()
        .update(aiMessages)
        .set({
            content: sql`${aiMessages.content} || ${delta}`,
        })
        .where(eq(aiMessages.id, messageId))
        .run();
}

export function setAssistantToolCalls(messageId: string, toolCalls: AiToolCall[]): AiMessage {
    return updateMessage(messageId, { toolCalls }, { touchConversation: false });
}

export function addAssistantToolResult(messageId: string, toolResult: AiToolResult): AiMessage {
    const current = getMessage(messageId);
    if (!current) {
        throw new Error(`AI message not found: ${messageId}`);
    }
    return updateMessage(
        messageId,
        { toolResults: [...current.toolResults, toolResult] },
        { touchConversation: false },
    );
}

export function deleteMessage(messageId: string): void {
    const current = getMessage(messageId);
    if (!current) {
        return;
    }

    getDb().delete(aiMessages).where(eq(aiMessages.id, messageId)).run();
    touchConversation(current.conversationId);
    logChange('ai_messages', messageId, 'DELETE', { id: messageId });
    logConversationChange(current.conversationId);
}

/**
 * Log the final state of an assistant message for sync.
 * Call once after streaming is complete to avoid flooding the change log during generation.
 */
export function syncMessage(messageId: string): void {
    const row = getDb().select().from(aiMessages).where(eq(aiMessages.id, messageId)).get();
    if (!row) {
        return;
    }

    logChange('ai_messages', messageId, 'SAVE', row);
    logConversationChange(row.conversationId);
}
