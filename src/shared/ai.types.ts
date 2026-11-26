// ---------------------------------------------------------------------------
// Provider IDs & basic types
// ---------------------------------------------------------------------------

export const BUILTIN_PROVIDER_IDS = ['openrouter', 'openai', 'gemini', 'claude', 'ollama'] as const;
export type AiBuiltinProviderId = (typeof BUILTIN_PROVIDER_IDS)[number];
export type AiProviderId = AiBuiltinProviderId | string;
export type AiMessageRole = 'system' | 'user' | 'assistant' | 'tool';
export type AiLanguagePreference = 'active' | 'explicit-only';
export const AI_CONVERSATION_HISTORY_PAGE_SIZE = 30;
export const AI_MESSAGE_HISTORY_PAGE_SIZE = 30;

/** Below this the assistant warns in settings and refuses to run: the prompt alone would not fit. */
export const RECOMMENDED_MIN_CONTEXT_WINDOW = 32_000;

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export interface AiProviderConfig {
    enabled: boolean;
    apiKey?: string;
    baseUrl?: string;
    model?: string | null;
}

export interface AiCustomProviderConfig {
    id: string;
    name: string;
    baseUrl: string;
    apiKey?: string;
    defaultModel: string;
    model?: string | null;
}

export type AiProviders = Record<AiBuiltinProviderId, AiProviderConfig>;

export type AiProviderFieldKey = 'apiKey' | 'baseUrl' | 'model';
export type AiProviderFieldKind = 'secret' | 'text';
export type AiProviderKind = 'remote';

export interface AiProviderFieldDefinition {
    key: AiProviderFieldKey;
    kind: AiProviderFieldKind;
    required?: boolean;
}

export interface AiProviderDefinition {
    id: AiBuiltinProviderId;
    kind: AiProviderKind;
    name: string;
    description: string;
    apiKeyUrl?: string;
    configurableFields: AiProviderFieldDefinition[];
}

export interface AiModelLimits {
    contextWindow?: number;
    maxOutputTokens?: number;
}

export interface AiRemoteModel extends AiModelLimits {
    id: string;
    name: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface AiSettings {
    enabled: boolean;
    activeProvider: AiProviderId | null;
    languagePreference: AiLanguagePreference;
    maxHistoryConversations: number;
    providers: AiProviders;
    customProviders: AiCustomProviderConfig[];
}

export const DEFAULT_MODELS: Record<AiBuiltinProviderId, string | null> = {
    openrouter: 'openai/gpt-5-mini',
    openai: 'gpt-5-mini',
    gemini: 'gemini-2.5-flash',
    claude: 'claude-haiku-4-5',
    ollama: 'llama3.2',
};

export const DEFAULT_PROVIDER_BASE_URLS: Record<AiBuiltinProviderId, string> = {
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    claude: 'https://api.anthropic.com/v1',
    ollama: 'http://localhost:11434/v1',
};

export const BUILTIN_PROVIDER_REQUIRES_API_KEY: Record<AiBuiltinProviderId, boolean> = {
    openrouter: true,
    openai: true,
    gemini: true,
    claude: true,
    ollama: false,
};

export const MAX_HISTORY_CONVERSATIONS = { min: 1, max: 500 } as const;

export function createDefaultAiSettings(): AiSettings {
    const providers = {} as AiProviders;
    for (const id of BUILTIN_PROVIDER_IDS) {
        providers[id] = {
            enabled: false,
            model: DEFAULT_MODELS[id],
            baseUrl: DEFAULT_PROVIDER_BASE_URLS[id],
        };
    }
    return {
        enabled: true,
        activeProvider: null,
        languagePreference: 'active',
        maxHistoryConversations: 50,
        providers,
        customProviders: [],
    };
}

// ---------------------------------------------------------------------------
// Settings resolvers (shared between main & renderer)
// ---------------------------------------------------------------------------

/** Resolve the active model from the provider's own config, with default fallback. */
export function resolveActiveModel(settings: AiSettings): string | null {
    const providerId = settings.activeProvider;
    if (!providerId) {
        return null;
    }

    if ((BUILTIN_PROVIDER_IDS as readonly string[]).includes(providerId)) {
        const builtinId = providerId as AiBuiltinProviderId;
        return settings.providers[builtinId]?.model || DEFAULT_MODELS[builtinId] || null;
    }

    const custom = settings.customProviders.find((p) => p.id === providerId);
    return custom?.model || custom?.defaultModel || null;
}

export function isBuiltinProviderId(providerId: string): providerId is AiBuiltinProviderId {
    return (BUILTIN_PROVIDER_IDS as readonly string[]).includes(providerId);
}

export function resolveProviderBaseUrl(
    settings: AiSettings,
    providerId: string,
): string | undefined {
    if (isBuiltinProviderId(providerId)) {
        return settings.providers[providerId]?.baseUrl ?? DEFAULT_PROVIDER_BASE_URLS[providerId];
    }

    return settings.customProviders.find((provider) => provider.id === providerId)?.baseUrl;
}

export function resolveProviderApiKey(
    settings: AiSettings,
    providerId: string,
): string | undefined {
    if (isBuiltinProviderId(providerId)) {
        return settings.providers[providerId]?.apiKey;
    }

    return settings.customProviders.find((provider) => provider.id === providerId)?.apiKey;
}

/** Resolve the display name of the active provider. */
export function resolveProviderName(
    settings: AiSettings,
    catalog?: { id: string; name: string }[],
): string | null {
    const providerId = settings.activeProvider;
    if (!providerId) {
        return null;
    }

    const catalogEntry = catalog?.find((p) => p.id === providerId);
    if (catalogEntry) {
        return catalogEntry.name;
    }

    const custom = settings.customProviders.find((p) => p.id === providerId);
    return custom?.name ?? providerId;
}

// ---------------------------------------------------------------------------
// Conversations & messages
// ---------------------------------------------------------------------------

export interface AiConversation {
    id: string;
    title: string | null;
    summary: string | null;
    aiTitle: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AiToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
}

export interface AiToolResult {
    toolCallId: string;
    name: string;
    output: unknown;
    isError?: boolean;
}

export interface AiMessage {
    id: string;
    conversationId: string;
    role: AiMessageRole;
    content: string;
    toolCalls: AiToolCall[];
    toolResults: AiToolResult[];
    createdAt: string;
}

export interface AiConversationHistoryPageRequest {
    limit?: number;
    loadedCount?: number;
    /** Case- and accent-insensitive match on the conversation title */
    search?: string;
}

export interface AiConversationHistoryPage {
    conversations: AiConversation[];
    loadedCount: number;
    totalCount: number;
    hasMore: boolean;
}

export interface AiMessageHistoryPageRequest {
    conversationId: string;
    limit?: number;
    loadedCount?: number;
}

export interface AiMessageHistoryPage {
    messages: AiMessage[];
    loadedCount: number;
    totalCount: number;
    hasMore: boolean;
}

export interface AiSendMessageRequest {
    conversationId: string;
    messages: string[];
    generationId: string;
}

export interface AiSendMessageResult {
    generationId: string;
    conversation: AiConversation;
    userMessages: AiMessage[];
    assistantMessage: AiMessage;
}

export interface AiRetryMessageRequest {
    conversationId: string;
    lastUserMessageId: string;
    generationId: string;
}

export interface AiRetryMessageResult {
    generationId: string;
    conversation: AiConversation;
    assistantMessage: AiMessage;
}

export interface AiProviderTestResult {
    valid: boolean;
    error?: string;
}

// ---------------------------------------------------------------------------
// IPC push events (main → renderer)
// ---------------------------------------------------------------------------

export interface AiStreamChunkEvent {
    conversationId: string;
    generationId: string;
    messageId: string;
    delta: string;
}

export type AiRunFinishReason =
    'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'interrupted' | 'other';

export type AiRunStoppedBy = 'model' | 'stop-condition' | 'tool-without-execute' | 'approval';

/** How a finished run ended, so the renderer can tell a full answer from a cut one. */
export interface AiRunOutcome {
    finishReason: AiRunFinishReason;
    stoppedBy: AiRunStoppedBy;
    /** The answer is still cut by the output limit after the automatic continuations. */
    truncated: boolean;
    /** The step limit was reached, so the last step was made to write the answer. */
    stepLimitReached: boolean;
    steps: number;
    continuations: number;
}

export interface AiStreamCompleteEvent {
    conversationId: string;
    generationId: string;
    messageId: string;
    outcome?: AiRunOutcome;
}

export interface AiStreamCancelEvent {
    conversationId: string;
    generationId: string;
    messageId: string;
}

export type AiErrorCode =
    | 'not-configured'
    | 'auth'
    | 'model-not-found'
    | 'rate-limit'
    | 'quota'
    | 'context-too-long'
    | 'provider-unavailable'
    | 'network'
    | 'timeout'
    | 'invalid-request'
    | 'unknown';

export interface AiStreamErrorEvent {
    conversationId: string;
    generationId: string;
    messageId: string;
    error: string;
    code?: AiErrorCode;
    retryable?: boolean;
}

export interface AiToolEvent {
    conversationId: string;
    generationId: string;
    messageId: string;
    toolName: string;
    toolCallId: string;
    payload?: unknown;
    isError?: boolean;
}

/** Tools report expected failures by returning `{ error }`; agents return `status: 'failed'`. */
export function isToolErrorOutput(output: unknown): boolean {
    if (!output || typeof output !== 'object' || Array.isArray(output)) return false;
    const record = output as { error?: unknown; status?: unknown };
    return (
        (typeof record.error === 'string' && record.error.length > 0) || record.status === 'failed'
    );
}

export interface AiReasoningEvent {
    conversationId: string;
    generationId: string;
    messageId: string;
    delta: string;
}

export interface AiConversationUpdatedEvent {
    conversation: AiConversation;
}
