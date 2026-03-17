import type { BrowserWindow } from 'electron';
import { PushChannels } from '@shared/ipc.types';
import type { AiToolCall, AiToolResult } from '@shared/ai.types';
import * as aiRepo from '@main/database/repositories/ai.repository';
import { sendToRenderer } from '@main/ipc/register';

export function dispatchTextDelta(
    browserWindow: BrowserWindow,
    conversationId: string,
    assistantMessageId: string,
    delta: string,
): void {
    aiRepo.appendAssistantContent(assistantMessageId, delta);
    sendToRenderer(browserWindow, PushChannels.aiStreamChunk, {
        conversationId,
        messageId: assistantMessageId,
        delta,
    });
}

export function dispatchToolCallStart(
    browserWindow: BrowserWindow,
    conversationId: string,
    assistantMessageId: string,
    toolCall: AiToolCall,
): void {
    const existing = aiRepo.getMessage(assistantMessageId);
    aiRepo.setAssistantToolCalls(assistantMessageId, [...(existing?.toolCalls ?? []), toolCall]);
    sendToRenderer(browserWindow, PushChannels.aiToolCallStart, {
        conversationId,
        messageId: assistantMessageId,
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        payload: toolCall.input,
    });
}

export function dispatchReasoningDelta(
    browserWindow: BrowserWindow,
    conversationId: string,
    assistantMessageId: string,
    delta: string,
): void {
    sendToRenderer(browserWindow, PushChannels.aiReasoningDelta, {
        conversationId,
        messageId: assistantMessageId,
        delta,
    });
}

export function dispatchToolCallComplete(
    browserWindow: BrowserWindow,
    conversationId: string,
    assistantMessageId: string,
    toolResult: AiToolResult,
): void {
    aiRepo.addAssistantToolResult(assistantMessageId, toolResult);
    sendToRenderer(browserWindow, PushChannels.aiToolCallComplete, {
        conversationId,
        messageId: assistantMessageId,
        toolName: toolResult.name,
        toolCallId: toolResult.toolCallId,
        payload: toolResult.output,
    });
}
