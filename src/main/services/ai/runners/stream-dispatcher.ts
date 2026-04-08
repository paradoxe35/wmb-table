import type { BrowserWindow } from 'electron';
import { PushChannels } from '@shared/ipc.types';
import type { AiToolCall, AiToolResult } from '@shared/ai.types';
import * as aiRepo from '@main/database/repositories/ai.repository';
import { sendToRenderer } from '@main/ipc/register';

export type RunDispatchGuard = (generationId: string, assistantMessageId: string) => boolean;

export function dispatchTextDelta(
    browserWindow: BrowserWindow,
    conversationId: string,
    generationId: string,
    assistantMessageId: string,
    delta: string,
    isCurrentRun: RunDispatchGuard,
): void {
    if (!isCurrentRun(generationId, assistantMessageId)) {
        return;
    }

    aiRepo.appendAssistantContent(assistantMessageId, delta);
    sendToRenderer(browserWindow, PushChannels.aiStreamChunk, {
        conversationId,
        generationId,
        messageId: assistantMessageId,
        delta,
    });
}

export function dispatchToolCallStart(
    browserWindow: BrowserWindow,
    conversationId: string,
    generationId: string,
    assistantMessageId: string,
    toolCall: AiToolCall,
    isCurrentRun: RunDispatchGuard,
): void {
    if (!isCurrentRun(generationId, assistantMessageId)) {
        return;
    }

    const existing = aiRepo.getMessage(assistantMessageId);
    aiRepo.setAssistantToolCalls(assistantMessageId, [...(existing?.toolCalls ?? []), toolCall]);
    sendToRenderer(browserWindow, PushChannels.aiToolCallStart, {
        conversationId,
        generationId,
        messageId: assistantMessageId,
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        payload: toolCall.input,
    });
}

export function dispatchReasoningDelta(
    browserWindow: BrowserWindow,
    conversationId: string,
    generationId: string,
    assistantMessageId: string,
    delta: string,
    isCurrentRun: RunDispatchGuard,
): void {
    if (!isCurrentRun(generationId, assistantMessageId)) {
        return;
    }

    sendToRenderer(browserWindow, PushChannels.aiReasoningDelta, {
        conversationId,
        generationId,
        messageId: assistantMessageId,
        delta,
    });
}

export function dispatchToolCallComplete(
    browserWindow: BrowserWindow,
    conversationId: string,
    generationId: string,
    assistantMessageId: string,
    toolResult: AiToolResult,
    isCurrentRun: RunDispatchGuard,
): void {
    if (!isCurrentRun(generationId, assistantMessageId)) {
        return;
    }

    aiRepo.addAssistantToolResult(assistantMessageId, toolResult);
    sendToRenderer(browserWindow, PushChannels.aiToolCallComplete, {
        conversationId,
        generationId,
        messageId: assistantMessageId,
        toolName: toolResult.name,
        toolCallId: toolResult.toolCallId,
        payload: toolResult.output,
    });
}
