import { NoSuchModelError, type ProviderV3 } from '@ai-sdk/provider';
import { LocalLanguageModel } from './local-language-model';
import { LocalRuntimeService } from './local-runtime.service';

function unsupportedModelError(
    modelId: string,
    modelType: NoSuchModelError['modelType'],
): NoSuchModelError {
    return new NoSuchModelError({
        modelId,
        modelType,
        message: `Local provider only supports language models. Unsupported ${modelType}: ${modelId}`,
    });
}

export function createLocalProvider(input: {
    runtime: LocalRuntimeService;
    defaultLanguageCode: string;
}): ProviderV3 {
    return {
        specificationVersion: 'v3',
        languageModel: (modelId: string) =>
            new LocalLanguageModel(modelId, {
                runtime: input.runtime,
                defaultLanguageCode: input.defaultLanguageCode,
            }),
        embeddingModel: (modelId: string) => {
            throw unsupportedModelError(modelId, 'embeddingModel');
        },
        imageModel: (modelId: string) => {
            throw unsupportedModelError(modelId, 'imageModel');
        },
    };
}
