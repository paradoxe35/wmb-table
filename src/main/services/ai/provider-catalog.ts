import type { AiProviderDefinition } from '@shared/ai.types';

const PROVIDER_DEFINITIONS: AiProviderDefinition[] = [
    {
        id: 'local',
        kind: 'local',
        name: 'Local',
        description: 'Fonctionne sans connexion internet, directement sur votre ordinateur.',
        configurableFields: [{ key: 'model', kind: 'text' }],
    },
    {
        id: 'openrouter',
        kind: 'remote',
        name: 'OpenRouter',
        description: 'Accédez à plusieurs modèles avec une seule clé API.',
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
        configurableFields: [
            { key: 'apiKey', kind: 'secret', required: true },
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
