import { wrapLanguageModel } from 'ai';
import type { LanguageModel } from 'ai';

/**
 * Several OpenAI-compatible endpoints reject reasoning parts on follow-up requests. Safe only
 * while no provider runs extended thinking, which needs those blocks to round-trip verbatim.
 */
export function wrapReasoningFilteredModel(model: LanguageModel): LanguageModel {
    return wrapLanguageModel({
        model: model as any,
        middleware: {
            specificationVersion: 'v3',
            transformParams: async ({ params }) => {
                return {
                    ...params,
                    prompt: params.prompt.map((message) => {
                        if (message.role === 'assistant' && Array.isArray(message.content)) {
                            return {
                                ...message,
                                content: message.content.filter((part) => {
                                    return part.type !== 'reasoning';
                                }),
                            };
                        }

                        return message;
                    }),
                };
            },
        },
    }) as LanguageModel;
}
