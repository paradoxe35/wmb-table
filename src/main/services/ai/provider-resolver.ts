import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { AiProviderConfig, AiSettings } from '@shared/ai.types';
import { wrapReasoningFilteredModel } from './model-wrapper';

interface ProviderFactory {
    create(apiKey: string, modelId: string, baseUrl?: string): LanguageModel;
    requiresApiKey: boolean;
}

const BUILTIN_PROVIDERS: Record<string, ProviderFactory> = {
    openrouter: {
        requiresApiKey: true,
        create: (apiKey, modelId) =>
            createOpenAICompatible({
                name: 'openrouter',
                apiKey,
                baseURL: 'https://openrouter.ai/api/v1',
            })(modelId),
    },
    openai: {
        requiresApiKey: true,
        create: (apiKey, modelId) => createOpenAI({ apiKey })(modelId),
    },
    gemini: {
        requiresApiKey: true,
        create: (apiKey, modelId) => createGoogleGenerativeAI({ apiKey })(modelId),
    },
    claude: {
        requiresApiKey: true,
        create: (apiKey, modelId) => createAnthropic({ apiKey })(modelId),
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
        const providerConfig = settings.providers[providerId as keyof AiSettings['providers']] as
            | AiProviderConfig
            | undefined;
        const apiKey = input.apiKey ?? providerConfig?.apiKey;
        if (builtinFactory.requiresApiKey && !apiKey) {
            throw new Error('La clé API est manquante pour ce fournisseur.');
        }
        return wrapReasoningFilteredModel(builtinFactory.create(apiKey ?? '', modelId));
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
