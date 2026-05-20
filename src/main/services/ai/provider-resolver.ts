import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import {
    BUILTIN_PROVIDER_REQUIRES_API_KEY,
    DEFAULT_PROVIDER_BASE_URLS,
    resolveProviderApiKey,
    resolveProviderBaseUrl,
    type AiBuiltinProviderId,
    type AiSettings,
} from '@shared/ai.types';
import { wrapReasoningFilteredModel } from './model-wrapper';

interface ProviderFactory {
    create(apiKey: string, modelId: string, baseUrl?: string): LanguageModel;
}

const BUILTIN_PROVIDERS: Record<string, ProviderFactory> = {
    openrouter: {
        create: (apiKey, modelId) =>
            createOpenAICompatible({
                name: 'openrouter',
                apiKey,
                baseURL: DEFAULT_PROVIDER_BASE_URLS.openrouter,
            })(modelId),
    },
    openai: {
        create: (apiKey, modelId) => createOpenAI({ apiKey })(modelId),
    },
    gemini: {
        create: (apiKey, modelId) => createGoogleGenerativeAI({ apiKey })(modelId),
    },
    claude: {
        create: (apiKey, modelId) => createAnthropic({ apiKey })(modelId),
    },
    ollama: {
        create: (apiKey, modelId, baseUrl) =>
            createOpenAICompatible({
                name: 'ollama',
                apiKey: apiKey || 'ollama',
                baseURL: baseUrl || DEFAULT_PROVIDER_BASE_URLS.ollama,
            })(modelId),
    },
};

// Re-export from shared for backward compat
export { resolveActiveModel } from '@shared/ai.types';

export function resolveLanguageModel(input: {
    settings: AiSettings;
    providerId: string;
    modelId: string;
    apiKey?: string;
    baseUrl?: string;
}): LanguageModel {
    const { providerId, modelId, settings } = input;

    const builtinFactory = BUILTIN_PROVIDERS[providerId];
    if (builtinFactory) {
        const builtinId = providerId as AiBuiltinProviderId;
        const apiKey = input.apiKey ?? resolveProviderApiKey(settings, providerId);
        if (BUILTIN_PROVIDER_REQUIRES_API_KEY[builtinId] && !apiKey) {
            throw new Error('La clé API est manquante pour ce fournisseur.');
        }
        const baseUrl = input.baseUrl ?? resolveProviderBaseUrl(settings, providerId);
        return wrapReasoningFilteredModel(builtinFactory.create(apiKey ?? '', modelId, baseUrl));
    }

    const customProvider = settings.customProviders.find((p) => p.id === providerId);
    if (!customProvider) {
        throw new Error('Fournisseur IA inconnu.');
    }

    return wrapReasoningFilteredModel(
        createOpenAICompatible({
            name: customProvider.id,
            apiKey: input.apiKey ?? customProvider.apiKey,
            baseURL: input.baseUrl ?? customProvider.baseUrl,
        })(modelId),
    );
}
