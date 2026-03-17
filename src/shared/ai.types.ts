export const BUILTIN_PROVIDER_IDS = ['local', 'openrouter', 'openai', 'gemini', 'claude'] as const;
export type AiBuiltinProviderId = (typeof BUILTIN_PROVIDER_IDS)[number];
export type AiProviderId = AiBuiltinProviderId | string;
export type AiMessageRole = 'system' | 'user' | 'assistant' | 'tool';
export type AiLanguagePreference = 'active' | 'explicit-only';

export interface AiProviderConfig {
    enabled: boolean;
    apiKey?: string;
    baseUrl?: string;
    model?: string | null;
    gpuEnabled?: boolean; // local provider only — offload layers to GPU
}

export interface AiCustomProviderConfig {
    id: string;
    name: string;
    baseUrl: string;
    apiKey?: string;
    enabled: boolean;
    models: string[];
    defaultModel?: string | null;
}

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

export type AiProviders = Record<AiBuiltinProviderId, AiProviderConfig>;

export interface AiSettings {
    enabled: boolean;
    activeProvider: AiProviderId | null;
    activeModel: string | null;
    languagePreference: AiLanguagePreference;
    maxHistoryConversations: number;
    maxContextMessages: number;
    providers: AiProviders;
    customProviders: AiCustomProviderConfig[];
}

export interface AiConversation {
    id: string;
    title: string | null;
    languageCode: string;
    summary: string | null;
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
    overrideLanguageCode?: string;
}

export interface AiSendMessageResult {
    conversation: AiConversation;
    userMessage: AiMessage;
    assistantMessage: AiMessage;
}

export interface AiProviderTestResult {
    valid: boolean;
    error?: string;
}

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
    configurableFields: AiProviderFieldDefinition[];
}

export interface AiRemoteModel {
    id: string;
    name: string;
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

export interface AiStreamChunkEvent {
    conversationId: string;
    messageId: string;
    delta: string;
}

export interface AiStreamCompleteEvent {
    conversationId: string;
    messageId: string;
}

export interface AiStreamErrorEvent {
    conversationId: string;
    messageId: string;
    error: string;
}

export interface AiToolEvent {
    conversationId: string;
    messageId: string;
    toolName: string;
    toolCallId: string;
    payload?: unknown;
}

export interface AiReasoningEvent {
    conversationId: string;
    messageId: string;
    delta: string;
}

const DEFAULT_MODELS: Record<AiBuiltinProviderId, string | null> = {
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
        activeModel: null,
        languagePreference: 'active',
        maxHistoryConversations: 50,
        maxContextMessages: 18,
        providers,
        customProviders: [],
    };
}
