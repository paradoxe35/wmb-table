import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { AiProviderConfig, AiSettings } from '@shared/ai.types';
import { BUILTIN_PROVIDER_IDS } from '@shared/ai.types';
import type { LocalRuntimeService } from './local/local-runtime.service';
import { createLocalProvider } from './local/local-provider';
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

/**
 * Resolve the active model for a provider.
 * Checks activeModel first, then falls back to the provider's own config.
 */
export function resolveActiveModel(settings: AiSettings): string | null {
    const providerId = settings.activeProvider;
    if (!providerId) return null;

    // 1. Explicit activeModel (if set and non-empty)
    if (settings.activeModel) return settings.activeModel;

    // 2. Builtin provider config
    if ((BUILTIN_PROVIDER_IDS as readonly string[]).includes(providerId)) {
        return settings.providers[providerId as keyof AiSettings['providers']]?.model || null;
    }

    // 3. Custom provider config
    return settings.customProviders.find((p) => p.id === providerId)?.defaultModel || null;
}

export function resolveLanguageModel(input: {
    settings: AiSettings;
    providerId: string;
    modelId: string;
    defaultLanguageCode?: string;
    localRuntime?: LocalRuntimeService;
    apiKey?: string;
    baseUrl?: string;
}): LanguageModel {
    const { providerId, modelId, settings } = input;

    if (providerId === 'local') {
        if (!input.localRuntime || !input.defaultLanguageCode) {
            throw new Error('Local provider requires a runtime service and default language.');
        }
        return createLocalProvider({
            runtime: input.localRuntime,
            defaultLanguageCode: input.defaultLanguageCode,
        }).languageModel(modelId);
    }

    const builtinFactory = BUILTIN_PROVIDERS[providerId];
    if (builtinFactory) {
        const providerConfig = settings.providers[providerId as keyof AiSettings['providers']] as
            | AiProviderConfig
            | undefined;
        const apiKey = input.apiKey ?? providerConfig?.apiKey;
        if (builtinFactory.requiresApiKey && !apiKey) {
            throw new Error(`API key is missing for provider: ${providerId}`);
        }
        return wrapReasoningFilteredModel(builtinFactory.create(apiKey ?? '', modelId));
    }

    const customProvider = settings.customProviders.find((p) => p.id === providerId);
    if (!customProvider) {
        throw new Error(`Unknown AI provider: ${providerId}`);
    }

    return wrapReasoningFilteredModel(
        createOpenAICompatible({
            name: customProvider.id,
            apiKey: input.apiKey ?? customProvider.apiKey,
            baseURL: input.baseUrl ?? customProvider.baseUrl,
        })(modelId),
    );
}
