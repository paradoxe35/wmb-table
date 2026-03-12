import type {
    LanguageModelV3Message,
    LanguageModelV3Prompt,
    LanguageModelV3ToolResultOutput,
} from '@ai-sdk/provider';
import type { ChatHistoryItem, ChatModelFunctionCall } from 'node-llama-cpp';

export interface LocalPromptInput {
    systemPrompt: string;
    history: ChatHistoryItem[];
    nextPrompt: string;
}

function getTextFromUserMessage(
    message: Extract<LanguageModelV3Message, { role: 'user' }>,
): string {
    return message.content
        .filter((part) => {
            return part.type === 'text';
        })
        .map((part) => {
            return part.text;
        })
        .join('\n')
        .trim();
}

function normalizeToolOutput(output: LanguageModelV3ToolResultOutput): unknown {
    switch (output.type) {
        case 'json':
        case 'error-json':
            return output.value;
        case 'text':
        case 'error-text':
            return output.value;
        case 'execution-denied':
            return { denied: true, reason: output.reason ?? null };
        case 'content':
            return output.value;
        default:
            return null;
    }
}

function extractSystemPrompt(prompt: LanguageModelV3Prompt): string {
    return prompt
        .filter((message): message is Extract<LanguageModelV3Message, { role: 'system' }> => {
            return message.role === 'system';
        })
        .map((message) => {
            return message.content;
        })
        .join('\n\n')
        .trim();
}

export function convertPromptToLocalInput(prompt: LanguageModelV3Prompt): LocalPromptInput {
    const systemPrompt = extractSystemPrompt(prompt);
    const history: ChatHistoryItem[] = [];
    const toolCallMap = new Map<string, ChatModelFunctionCall>();
    const nonSystemMessages = prompt.filter((message) => {
        return message.role !== 'system';
    });

    let nextPrompt = '';

    for (let index = 0; index < nonSystemMessages.length; index += 1) {
        const message = nonSystemMessages[index];
        const isLast = index === nonSystemMessages.length - 1;

        if (message.role === 'user') {
            const text = getTextFromUserMessage(message);
            if (!text) {
                continue;
            }
            if (isLast) {
                nextPrompt = text;
            } else {
                history.push({ type: 'user', text });
            }
            continue;
        }

        if (message.role === 'assistant') {
            const response: Array<string | ChatModelFunctionCall> = [];
            for (const part of message.content) {
                if (part.type === 'text' && part.text.trim()) {
                    response.push(part.text);
                    continue;
                }
                if (part.type === 'tool-call') {
                    const toolCall: ChatModelFunctionCall = {
                        type: 'functionCall',
                        name: part.toolName,
                        params: part.input,
                        result: null,
                    };
                    response.push(toolCall);
                    toolCallMap.set(part.toolCallId, toolCall);
                }
            }
            if (response.length > 0) {
                history.push({ type: 'model', response });
            }
            continue;
        }

        if (message.role === 'tool') {
            for (const part of message.content) {
                if (part.type !== 'tool-result') {
                    continue;
                }
                const toolCall = toolCallMap.get(part.toolCallId);
                if (toolCall) {
                    toolCall.result = normalizeToolOutput(part.output);
                }
            }
        }
    }

    return { systemPrompt, history, nextPrompt };
}
