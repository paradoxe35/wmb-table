import { z } from 'zod';
import {
    BUILTIN_PROVIDER_IDS,
    type AiConversationHistoryPageRequest,
    type AiCustomProviderConfig,
    type AiMessageHistoryPageRequest,
    type AiBuiltinProviderId,
    type AiProviderConfig,
    type AiProviders,
    type AiRetryMessageRequest,
    type AiSendMessageRequest,
    type AiSettings,
} from '@shared/ai.types';

export const MAX_HISTORY_CONVERSATIONS = { min: 1, max: 500 } as const;
export const MAX_MESSAGE_LENGTH = 100_000;
export const MAX_MESSAGES_PER_SEND = 50;
export const MESSAGE_TOO_LONG_ERROR = 'Le message est trop long. Raccourcissez-le puis réessayez.';

const MAX_ID_LENGTH = 200;
const MAX_TEXT_LENGTH = 4_096;
const MAX_PAGE_SIZE = 500;

const notBlank = (value: string) => value.trim().length > 0;

const idSchema = z.string().max(MAX_ID_LENGTH).refine(notBlank, 'Must not be empty');
const textSchema = z.string().max(MAX_TEXT_LENGTH);
const pageLimitSchema = z.number().int().min(1).max(MAX_PAGE_SIZE);
const pageOffsetSchema = z.number().int().min(0);

const messageSchema = z
    .string()
    .max(MAX_MESSAGE_LENGTH, MESSAGE_TOO_LONG_ERROR)
    .refine(notBlank, 'Le message ne peut pas être vide.');

const providerConfigSchema: z.ZodType<AiProviderConfig> = z.object({
    enabled: z.boolean(),
    apiKey: textSchema.optional(),
    baseUrl: textSchema.optional(),
    model: textSchema.nullable().optional(),
} satisfies Record<keyof AiProviderConfig, z.ZodType>);

// Unknown keys are dropped: stored settings can still hold the removed `local` provider.
const providersSchema: z.ZodType<AiProviders> = z.object(
    Object.fromEntries(BUILTIN_PROVIDER_IDS.map((id) => [id, providerConfigSchema])) as Record<
        AiBuiltinProviderId,
        typeof providerConfigSchema
    >,
);

// Settings saved by older versions can hold extra fields and a null default model.
const customProviderShape = {
    id: idSchema,
    name: textSchema,
    baseUrl: textSchema,
    apiKey: textSchema.optional(),
    defaultModel: textSchema.nullable().transform((model) => model ?? ''),
    model: textSchema.nullable().optional(),
} satisfies Record<keyof AiCustomProviderConfig, z.ZodType>;

const customProviderSchema: z.ZodType<AiCustomProviderConfig> = z.looseObject(customProviderShape);

const settingsPatchShape = {
    enabled: z.boolean(),
    activeProvider: idSchema.nullable(),
    languagePreference: z.enum(['active', 'explicit-only']),
    maxHistoryConversations: z
        .number()
        .int()
        .min(MAX_HISTORY_CONVERSATIONS.min)
        .max(MAX_HISTORY_CONVERSATIONS.max),
    providers: providersSchema,
    customProviders: z.array(customProviderSchema).max(MAX_PAGE_SIZE),
} satisfies Record<keyof AiSettings, z.ZodType>;

export const settingsPatchSchema = z.strictObject(settingsPatchShape).partial();

export const conversationIdSchema = idSchema;

export const conversationsPageRequestSchema: z.ZodType<AiConversationHistoryPageRequest> =
    z.strictObject({
        limit: pageLimitSchema.optional(),
        loadedCount: pageOffsetSchema.optional(),
        search: textSchema.optional(),
    });

export const createConversationInputSchema = z
    .strictObject({ title: textSchema.optional() })
    .optional();

export const conversationTitleSchema = textSchema;

export const messagesPageRequestSchema: z.ZodType<AiMessageHistoryPageRequest> = z.strictObject({
    conversationId: idSchema,
    limit: pageLimitSchema.optional(),
    loadedCount: pageOffsetSchema.optional(),
});

export const sendMessageRequestSchema: z.ZodType<AiSendMessageRequest> = z.strictObject({
    conversationId: idSchema,
    messages: z.array(messageSchema).min(1).max(MAX_MESSAGES_PER_SEND),
    generationId: idSchema,
});

export const retryMessageRequestSchema: z.ZodType<AiRetryMessageRequest> = z.strictObject({
    conversationId: idSchema,
    lastUserMessageId: idSchema,
    generationId: idSchema,
});

export const providerTestInputSchema = z.strictObject({
    providerId: idSchema,
    model: idSchema,
    apiKey: textSchema.optional(),
    baseUrl: textSchema.optional(),
});

export const providerModelsInputSchema = z.strictObject({
    providerId: idSchema,
    apiKey: textSchema.optional(),
    baseUrl: textSchema.optional(),
});

export const modelLimitsInputSchema = z.strictObject({
    providerId: idSchema,
    model: idSchema,
    baseUrl: textSchema.optional(),
});

export class InvalidAiInputError extends Error {
    override name = 'InvalidAiInputError';
}

export function parseAiInput<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
    const result = schema.safeParse(value);
    if (result.success) return result.data;

    const tooLong = result.error.issues.some((issue) => issue.message === MESSAGE_TOO_LONG_ERROR);
    if (tooLong) throw new InvalidAiInputError(MESSAGE_TOO_LONG_ERROR);

    throw new InvalidAiInputError(`Invalid ${label}: ${z.prettifyError(result.error)}`);
}
