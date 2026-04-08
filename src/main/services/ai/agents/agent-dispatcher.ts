import { PushChannels } from '@shared/ipc.types';
import { sendToRenderer } from '@main/ipc/register';
import type { AgentDispatch } from './types';

/**
 * Dispatches subagent tool progress to the renderer for live UX feedback.
 * Unlike the main stream-dispatcher, this does NOT persist to the database —
 * subagent internal tool calls are transient progress indicators only.
 */
export function dispatchAgentToolStart(
    dispatch: AgentDispatch,
    agentName: string,
    toolName: string,
    toolCallId: string,
    input: Record<string, unknown>,
): void {
    sendToRenderer(dispatch.browserWindow, PushChannels.aiToolCallStart, {
        conversationId: dispatch.conversationId,
        generationId: dispatch.generationId,
        messageId: dispatch.assistantMessageId,
        toolName: `${agentName}:${toolName}`,
        toolCallId,
        payload: input,
    });
}

export function dispatchAgentToolComplete(
    dispatch: AgentDispatch,
    agentName: string,
    toolName: string,
    toolCallId: string,
): void {
    sendToRenderer(dispatch.browserWindow, PushChannels.aiToolCallComplete, {
        conversationId: dispatch.conversationId,
        generationId: dispatch.generationId,
        messageId: dispatch.assistantMessageId,
        toolName: `${agentName}:${toolName}`,
        toolCallId,
        payload: {},
    });
}
