import type { AiProviderDefinition } from '@shared/ai.types';

const PROVIDER_DEFINITIONS: AiProviderDefinition[] = [
    {
        id: 'openrouter',
        kind: 'remote',
        name: 'OpenRouter',
        description: 'Accédez à plusieurs modèles avec une seule clé API.',
        apiKeyUrl: 'https://openrouter.ai/keys',
        configurableFields: [
            { key: 'apiKey', kind: 'secret', required: true },
            { key: 'model', kind: 'text' },
        ],
    },
    {
        id: 'openai',
        kind: 'remote',
        name: 'OpenAI',
        description: 'ChatGPT et autres modèles OpenAI.',
        apiKeyUrl: 'https://platform.openai.com/api-keys',
        configurableFields: [
            { key: 'apiKey', kind: 'secret', required: true },
            { key: 'model', kind: 'text' },
        ],
    },
    {
        id: 'gemini',
        kind: 'remote',
        name: 'Gemini',
        description: 'Les modèles Gemini de Google.',
        apiKeyUrl: 'https://aistudio.google.com/app/apikey',
        configurableFields: [
            { key: 'apiKey', kind: 'secret', required: true },
            { key: 'model', kind: 'text' },
        ],
    },
    {
        id: 'claude',
        kind: 'remote',
        name: 'Claude',
        description: "Les modèles Claude d'Anthropic.",
        apiKeyUrl: 'https://console.anthropic.com/settings/keys',
        configurableFields: [
            { key: 'apiKey', kind: 'secret', required: true },
            { key: 'model', kind: 'text' },
        ],
    },
    {
        id: 'ollama',
        kind: 'remote',
        name: 'Ollama',
        description:
            'Utilisez Ollama via son API compatible OpenAI, en local ou avec une URL cloud.',
        configurableFields: [
            { key: 'baseUrl', kind: 'text' },
            { key: 'apiKey', kind: 'secret' },
            { key: 'model', kind: 'text' },
        ],
    },
];

export function getAiProviderCatalog(): AiProviderDefinition[] {
    return PROVIDER_DEFINITIONS.map((provider) => ({
        ...provider,
        configurableFields: provider.configurableFields.map((field) => ({ ...field })),
    }));
}

export function findProviderDefinition(providerId: string): AiProviderDefinition | undefined {
    return PROVIDER_DEFINITIONS.find((provider) => provider.id === providerId);
}
