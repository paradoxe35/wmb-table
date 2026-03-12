import type {
    LanguageModelV3,
    LanguageModelV3CallOptions,
    LanguageModelV3Content,
    LanguageModelV3FinishReason,
    LanguageModelV3GenerateResult,
    LanguageModelV3StreamPart,
    LanguageModelV3StreamResult,
    LanguageModelV3FunctionTool,
} from '@ai-sdk/provider';
import { convertAsyncIteratorToReadableStream, generateId } from '@ai-sdk/provider-utils';
import type { AiToolResult } from '@shared/ai.types';
import { buildToolExecutors } from '../tools';
import { LocalRuntimeService } from './local-runtime.service';
import { buildLocalChatFunctions, filterToolExecutors } from './local-tool-adapter';
import { convertPromptToLocalInput } from './local-prompt-adapter';
import { AsyncStreamQueue } from './stream-queue';

type LocalLanguageModelConfig = {
    runtime: LocalRuntimeService;
    defaultLanguageCode: string;
};

type CollectedGeneration = {
    text: string;
    content: LanguageModelV3Content[];
    warnings: [];
};

function emptyUsage() {
    return {
        inputTokens: {
            total: undefined,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
        },
        outputTokens: { total: undefined, text: undefined, reasoning: undefined },
    };
}

function finishReason(raw: string = 'stop'): LanguageModelV3FinishReason {
    return {
        unified: raw === 'tool-calls' ? 'tool-calls' : raw === 'length' ? 'length' : 'stop',
        raw,
    };
}

function toJsonResult(output: unknown) {
    if (output == null) {
        return {};
    }
    return JSON.parse(JSON.stringify(output));
}

export class LocalLanguageModel implements LanguageModelV3 {
    readonly specificationVersion = 'v3' as const;
    readonly provider = 'local';
    readonly supportedUrls = {};

    constructor(
        readonly modelId: string,
        private readonly config: LocalLanguageModelConfig,
    ) {}

    async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
        const collected = await this.runInference(options);
        return {
            content: collected.content,
            finishReason: finishReason(),
            usage: emptyUsage(),
            warnings: collected.warnings,
            response: {
                id: generateId(),
                timestamp: new Date(),
                modelId: this.modelId,
            },
        };
    }

    async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
        const queue = new AsyncStreamQueue<LanguageModelV3StreamPart>();
        const textPartId = generateId();
        let textStarted = false;
        const promptInput = convertPromptToLocalInput(options.prompt);
        const executors = filterToolExecutors(
            buildToolExecutors(this.config.defaultLanguageCode),
            options.tools?.filter((tool): tool is LanguageModelV3FunctionTool => {
                return tool.type === 'function';
            }) ?? [],
            options.toolChoice,
        );

        queue.push({ type: 'stream-start', warnings: [] });

        void this.config.runtime
            .run({
                selectedModel: this.modelId,
                systemPrompt: promptInput.systemPrompt,
                history: promptInput.history,
                prompt: promptInput.nextPrompt,
                signal: options.abortSignal,
                functions: buildLocalChatFunctions({
                    executors,
                    onToolCall: (toolCall) => {
                        queue.push({
                            type: 'tool-call',
                            toolCallId: toolCall.id,
                            toolName: toolCall.name,
                            input: JSON.stringify(toolCall.input),
                            providerExecuted: true,
                        });
                    },
                    onToolResult: (toolResult) => {
                        queue.push({
                            type: 'tool-result',
                            toolCallId: toolResult.toolCallId,
                            toolName: toolResult.name,
                            result: toJsonResult(toolResult.output),
                        });
                    },
                }),
                onTextChunk: (chunk) => {
                    if (!chunk) {
                        return;
                    }
                    if (!textStarted) {
                        queue.push({ type: 'text-start', id: textPartId });
                        textStarted = true;
                    }
                    queue.push({ type: 'text-delta', id: textPartId, delta: chunk });
                },
            })
            .then(() => {
                if (textStarted) {
                    queue.push({ type: 'text-end', id: textPartId });
                }
                queue.push({
                    type: 'finish',
                    finishReason: finishReason(),
                    usage: emptyUsage(),
                });
                queue.close();
            })
            .catch((error) => {
                queue.push({ type: 'error', error });
                queue.close();
            });

        return {
            stream: convertAsyncIteratorToReadableStream(queue[Symbol.asyncIterator]()),
            response: {},
        };
    }

    private async runInference(options: LanguageModelV3CallOptions): Promise<CollectedGeneration> {
        const promptInput = convertPromptToLocalInput(options.prompt);
        const collected: CollectedGeneration = {
            text: '',
            content: [],
            warnings: [],
        };

        const executors = filterToolExecutors(
            buildToolExecutors(this.config.defaultLanguageCode),
            options.tools?.filter((tool): tool is LanguageModelV3FunctionTool => {
                return tool.type === 'function';
            }) ?? [],
            options.toolChoice,
        );

        await this.config.runtime.run({
            selectedModel: this.modelId,
            systemPrompt: promptInput.systemPrompt,
            history: promptInput.history,
            prompt: promptInput.nextPrompt,
            signal: options.abortSignal,
            functions: buildLocalChatFunctions({
                executors,
                onToolCall: (toolCall) => {
                    collected.content.push({
                        type: 'tool-call',
                        toolCallId: toolCall.id,
                        toolName: toolCall.name,
                        input: JSON.stringify(toolCall.input),
                        providerExecuted: true,
                    });
                },
                onToolResult: (toolResult: AiToolResult) => {
                    collected.content.push({
                        type: 'tool-result',
                        toolCallId: toolResult.toolCallId,
                        toolName: toolResult.name,
                        result: toJsonResult(toolResult.output),
                    });
                },
            }),
            onTextChunk: (chunk) => {
                collected.text += chunk;
            },
        });

        if (collected.text) {
            collected.content.unshift({
                type: 'text',
                text: collected.text,
            });
        }

        return collected;
    }
}
