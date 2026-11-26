import { randomUUID } from 'node:crypto';
import type { BrowserWindow } from 'electron';
import log from '@main/lib/logger';
import * as aiRepo from '@main/database/repositories/ai.repository';
import { sendToRenderer } from '@main/ipc/ipc-bridge';
import { PushChannels } from '@shared/ipc.types';
import type { AiMessage, AiRunOutcome } from '@shared/ai.types';
import { AssistantTextBuffer, type ReplyTarget } from './assistant-text-buffer';
import { classifyAiError } from './ai-errors';

export interface ChatRun extends ReplyTarget {
    controller: AbortController;
    startedAt: string;
}

function isEmptyReply(message: AiMessage): boolean {
    return (
        !message.content.trim() &&
        message.toolCalls.length === 0 &&
        message.toolResults.length === 0
    );
}

/** What a send returns when it was stopped before its reply row was created. */
export function unsavedReply(conversationId: string): AiMessage {
    return {
        id: randomUUID(),
        conversationId,
        role: 'assistant',
        content: '',
        toolCalls: [],
        toolResults: [],
        createdAt: new Date().toISOString(),
    };
}

/**
 * Owns every chat run from the moment a send arrives until it ends, so a Stop, a closed window
 * or the app quitting always finds the run, and the reply is saved before any end event.
 */
export class ChatRuns {
    private readonly runs = new Map<string, ChatRun>();
    private readonly text: AssistantTextBuffer;

    // The bytecode build cannot compile arrow functions in class field initializers.
    constructor() {
        this.text = new AssistantTextBuffer({
            isCurrent: (run) => this.isCurrent(run),
            onReplyLost: (run) => this.stop(run.conversationId),
        });
    }

    begin(browserWindow: BrowserWindow, conversationId: string, generationId: string): ChatRun {
        this.stop(conversationId);
        const run: ChatRun = {
            browserWindow,
            conversationId,
            generationId,
            assistantMessageId: null,
            controller: new AbortController(),
            startedAt: new Date().toISOString(),
        };
        this.runs.set(conversationId, run);
        return run;
    }

    /** Resolves to null as soon as the run is stopped, without waiting for `work`. */
    untilStopped<T>(run: ChatRun, work: Promise<T>): Promise<T | null> {
        const { signal } = run.controller;
        if (signal.aborted) return Promise.resolve(null);

        return new Promise<T | null>((resolve, reject) => {
            const onStop = () => resolve(null);
            signal.addEventListener('abort', onStop, { once: true });
            work.then(
                (value) => {
                    signal.removeEventListener('abort', onStop);
                    resolve(value);
                },
                (error: unknown) => {
                    signal.removeEventListener('abort', onStop);
                    if (signal.aborted) resolve(null);
                    else reject(error);
                },
            );
        });
    }

    /** A send for an unknown conversation creates a new one with its own id. */
    moveTo(run: ChatRun, conversationId: string): void {
        if (run.conversationId === conversationId) return;
        if (this.runs.get(run.conversationId) === run) this.runs.delete(run.conversationId);
        this.stop(conversationId);
        run.conversationId = conversationId;
        this.runs.set(conversationId, run);
    }

    attachReply(run: ChatRun, assistantMessageId: string): void {
        run.assistantMessageId = assistantMessageId;
    }

    isCurrent(run: ReplyTarget): boolean {
        return this.isCurrentReply(run.conversationId, run.generationId, run.assistantMessageId);
    }

    isCurrentReply(
        conversationId: string,
        generationId: string,
        assistantMessageId: string | null,
    ): boolean {
        const run = this.runs.get(conversationId);
        return run?.generationId === generationId && run.assistantMessageId === assistantMessageId;
    }

    /** Drops a run that failed to start; the caller reports the error itself. */
    release(run: ChatRun): void {
        if (this.runs.get(run.conversationId) === run) this.runs.delete(run.conversationId);
    }

    queueText(run: ChatRun, delta: string): void {
        this.text.queue(run, delta);
    }

    /** Returns false when the run was stopped meanwhile. */
    complete(run: ChatRun, outcome: AiRunOutcome): boolean {
        if (!this.end(run)) return false;

        aiRepo.touchConversation(run.conversationId);
        this.saveReply(run);
        sendToRenderer(run.browserWindow, PushChannels.aiStreamComplete, {
            conversationId: run.conversationId,
            generationId: run.generationId,
            messageId: run.assistantMessageId ?? '',
            outcome,
        });
        return true;
    }

    fail(run: ChatRun, error: unknown): void {
        if (!this.end(run)) return;

        run.controller.abort();
        this.saveReply(run);
        const { code, retryable, detail } = classifyAiError(error);
        log.error('AI generation failed', {
            conversationId: run.conversationId,
            code,
            retryable,
            detail,
        });
        sendToRenderer(run.browserWindow, PushChannels.aiStreamError, {
            conversationId: run.conversationId,
            generationId: run.generationId,
            messageId: run.assistantMessageId ?? '',
            error: detail,
            code,
            retryable,
        });
    }

    stop(conversationId: string): void {
        const run = this.runs.get(conversationId);
        if (!run || !this.end(run)) return;

        run.controller.abort();
        this.saveReply(run);
        sendToRenderer(run.browserWindow, PushChannels.aiStreamCancel, {
            conversationId,
            generationId: run.generationId,
            messageId: run.assistantMessageId ?? '',
        });
    }

    stopWindow(browserWindow: BrowserWindow): void {
        for (const run of [...this.runs.values()]) {
            if (run.browserWindow === browserWindow) this.stop(run.conversationId);
        }
    }

    stopAll(): void {
        for (const conversationId of [...this.runs.keys()]) {
            this.stop(conversationId);
        }
        this.text.discardAll();
    }

    /** Reply rows created before this moment cannot belong to a live run. */
    earliestStart(): string {
        const starts = [...this.runs.values()].map((run) => run.startedAt).sort();
        return starts[0] ?? new Date().toISOString();
    }

    private end(run: ChatRun): boolean {
        this.text.flush(run);
        if (!this.isCurrent(run)) return false;
        this.runs.delete(run.conversationId);
        return true;
    }

    /** Deletes an empty reply, or records the finished one for sync. */
    private saveReply(run: ChatRun): void {
        if (!run.assistantMessageId) return;
        try {
            const message = aiRepo.getMessage(run.assistantMessageId);
            if (!message) return;
            if (isEmptyReply(message)) aiRepo.deleteMessage(message.id);
            else aiRepo.syncMessage(message.id);
        } catch (error) {
            log.warn('Could not save the AI reply', {
                conversationId: run.conversationId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
