import type { BrowserWindow } from 'electron';
import * as aiRepo from '@main/database/repositories/ai.repository';
import { sendToRenderer } from '@main/ipc/ipc-bridge';
import { PushChannels } from '@shared/ipc.types';

const FLUSH_INTERVAL_MS = 40;
const FLUSH_THRESHOLD_CHARS = 160;

export interface ReplyTarget {
    browserWindow: BrowserWindow;
    conversationId: string;
    generationId: string;
    assistantMessageId: string | null;
}

interface PendingText {
    text: string;
    timer: ReturnType<typeof setTimeout> | null;
}

interface TextBufferHooks {
    isCurrent(run: ReplyTarget): boolean;
    onReplyLost(run: ReplyTarget): void;
}

/** Batches text deltas so the reply row and the renderer get a write every 40 ms, not per token. */
export class AssistantTextBuffer {
    private readonly pending = new Map<ReplyTarget, PendingText>();

    constructor(private readonly hooks: TextBufferHooks) {}

    queue(run: ReplyTarget, delta: string): void {
        if (!delta) return;

        const current = this.pending.get(run) ?? { text: '', timer: null };
        current.text += delta;
        this.pending.set(run, current);

        if (current.text.length >= FLUSH_THRESHOLD_CHARS) {
            this.flush(run);
            return;
        }
        current.timer ??= setTimeout(() => this.flush(run), FLUSH_INTERVAL_MS);
    }

    flush(run: ReplyTarget): void {
        const current = this.pending.get(run);
        if (!current) return;

        if (current.timer) clearTimeout(current.timer);
        this.pending.delete(run);
        if (!current.text || !run.assistantMessageId || !this.hooks.isCurrent(run)) return;

        if (!aiRepo.appendAssistantContent(run.assistantMessageId, current.text)) {
            this.hooks.onReplyLost(run);
            return;
        }
        sendToRenderer(run.browserWindow, PushChannels.aiStreamChunk, {
            conversationId: run.conversationId,
            generationId: run.generationId,
            messageId: run.assistantMessageId,
            delta: current.text,
        });
    }

    discardAll(): void {
        for (const current of this.pending.values()) {
            if (current.timer) clearTimeout(current.timer);
        }
        this.pending.clear();
    }
}
