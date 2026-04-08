// ---------------------------------------------------------------------------
// Provider IDs & basic types
// ---------------------------------------------------------------------------

export const BUILTIN_PROVIDER_IDS = ['local', 'openrouter', 'openai', 'gemini', 'claude'] as const;
export type AiBuiltinProviderId = (typeof BUILTIN_PROVIDER_IDS)[number];
export type AiProviderId = AiBuiltinProviderId | string;
export type AiMessageRole = 'system' | 'user' | 'assistant' | 'tool';
export type AiLanguagePreference = 'active' | 'explicit-only';

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export interface AiProviderConfig {
    enabled: boolean;
    apiKey?: string;
    baseUrl?: string;
    model?: string | null;
    gpuEnabled?: boolean;
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
export type AiProviderKind = 'remote' | 'local';

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

export interface AiRemoteModel {
    id: string;
    name: string;
    contextWindow?: number;
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
    local: null,
    openrouter: 'openai/gpt-5-mini',
    openai: 'gpt-5-mini',
    gemini: 'gemini-2.5-flash',
    claude: 'claude-haiku-4-5',
};

export function createDefaultAiSettings(): AiSettings {
    const providers = {} as AiProviders;
    for (const id of BUILTIN_PROVIDER_IDS) {
        providers[id] = { enabled: false, model: DEFAULT_MODELS[id] };
    }
    return {
        enabled: false,
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

export interface AiSendMessageRequest {
    conversationId: string;
    content: string;
    generationId: string;
}

export interface AiSendMessageResult {
    generationId: string;
    conversation: AiConversation;
    userMessage: AiMessage;
    assistantMessage: AiMessage;
}

export interface AiProviderTestResult {
    valid: boolean;
    error?: string;
}

// ---------------------------------------------------------------------------
// Local models
// ---------------------------------------------------------------------------

export interface AiLocalModelInfo {
    id: string;
    name: string;
    family: 'qwen' | 'gemma' | 'other';
    fileName: string;
    quantization: string;
    sizeBytes: number;
    downloaded: boolean;
    localPath?: string;
    recommended: boolean;
    contextSize?: number;
}

export interface AiSupportedLocalModel {
    id: string;
    name: string;
    family: 'qwen' | 'gemma' | 'other';
    description: string;
    quantization: string;
    recommended: boolean;
    downloadUrl: string;
    approximateSizeMb: number;
    installed: boolean;
    installedModel?: AiLocalModelInfo;
}

export interface AiModelScanResult {
    models: AiLocalModelInfo[];
    supportedModels: AiSupportedLocalModel[];
    scannedPath: string;
}

export interface AiModelDownloadProgress {
    modelId: string;
    percentage: number;
    status: 'downloading' | 'complete' | 'error';
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

export interface AiStreamCompleteEvent {
    conversationId: string;
    generationId: string;
    messageId: string;
}

export interface AiStreamCancelEvent {
    conversationId: string;
    generationId: string;
    messageId: string;
}

export interface AiStreamErrorEvent {
    conversationId: string;
    generationId: string;
    messageId: string;
    error: string;
}

export interface AiToolEvent {
    conversationId: string;
    generationId: string;
    messageId: string;
    toolName: string;
    toolCallId: string;
    payload?: unknown;
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
