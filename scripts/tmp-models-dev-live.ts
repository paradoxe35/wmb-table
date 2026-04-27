const MODELS_DEV_REGISTRY_URL = 'https://models.dev/api.json';
const PROVIDER_ALIASES: Record<string, string[]> = {
    claude: ['anthropic'],
    gemini: ['google'],
    openai: ['openai'],
    openrouter: ['openrouter'],
};

type ModelLimits = {
    contextWindow?: number;
    maxOutputTokens?: number;
};

type ModelLimitMap = Record<string, ModelLimits>;

type ModelsDevModel = {
    id: string;
    limit?: {
        context?: number;
        output?: number;
    };
};

type ModelsDevProvider = {
    id: string;
    models?: Record<string, ModelsDevModel>;
};

function toPositiveInt(value: unknown): number | undefined {
    return typeof value === 'number' && value > 0 ? Math.floor(value) : undefined;
}

function addModelLimits(registry: ModelLimitMap, keys: string[], limits: ModelLimits): void {
    for (const key of keys) {
        registry[key.toLowerCase()] = limits;
    }
}

function buildModelsDevLimitMap(raw: Record<string, ModelsDevProvider>): ModelLimitMap {
    const result: ModelLimitMap = {};

    for (const [providerKey, provider] of Object.entries(raw)) {
        if (!provider?.models) {
            continue;
        }

        for (const [modelKey, model] of Object.entries(provider.models)) {
            const contextWindow = toPositiveInt(model.limit?.context);
            const maxOutputTokens = toPositiveInt(model.limit?.output);
            if (!contextWindow && !maxOutputTokens) {
                continue;
            }

            addModelLimits(
                result,
                [model.id, modelKey, `${provider.id}/${model.id}`, `${providerKey}/${model.id}`],
                { contextWindow, maxOutputTokens },
            );
        }
    }

    return result;
}

function buildCandidates(providerId: string, modelId: string): string[] {
    const model = modelId.toLowerCase();
    const base = model.includes('/') ? model.split('/').pop()! : model;
    const providerAliases = [providerId, ...(PROVIDER_ALIASES[providerId] ?? [])];
    return [
        ...providerAliases.map((provider) => `${provider}/${model}`),
        ...providerAliases.map((provider) => `${provider}/${base}`),
        model,
        base,
    ];
}

function assertLimitShape(label: string, limits: ModelLimits | undefined): void {
    if (!limits) {
        throw new Error(`${label}: no limits resolved`);
    }
    if (!limits.contextWindow && !limits.maxOutputTokens) {
        throw new Error(`${label}: expected at least one positive limit`);
    }
}

async function main() {
    const response = await fetch(MODELS_DEV_REGISTRY_URL);
    if (!response.ok) {
        throw new Error(`models.dev HTTP ${response.status}`);
    }

    const raw = (await response.json()) as Record<string, ModelsDevProvider>;
    const limitsByKey = buildModelsDevLimitMap(raw);
    const keys = Object.keys(limitsByKey);

    if (keys.length < 100) {
        throw new Error(`expected a large model registry, got ${keys.length} keyed entries`);
    }

    const cases = [
        { providerId: 'openai', modelId: 'gpt-5-mini' },
        { providerId: 'gemini', modelId: 'gemini-2.5-flash' },
        { providerId: 'claude', modelId: 'claude-haiku-4-5' },
    ];

    console.log(`models.dev providers: ${Object.keys(raw).length}`);
    console.log(`models.dev keyed model limits: ${keys.length}`);

    for (const item of cases) {
        const limits = buildCandidates(item.providerId, item.modelId)
            .map((candidate) => limitsByKey[candidate])
            .find(Boolean);
        const label = `${item.providerId}/${item.modelId}`;
        assertLimitShape(label, limits);
        console.log(label, JSON.stringify(limits));
    }
}

void main();
