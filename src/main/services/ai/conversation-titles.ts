import type { BrowserWindow } from 'electron';
import type { LanguageModel } from 'ai';
import log from '@main/lib/logger';
import * as aiRepo from '@main/database/repositories/ai.repository';
import { sendToRenderer } from '@main/ipc/register';
import { PushChannels } from '@shared/ipc.types';
import { generateConversationTitle, shouldGenerateTitle } from './title-generator';

const MAX_TITLE_INPUT_MESSAGES = 20;
/** The first try and one retry on a later reply; after that the first-message title stays. */
const MAX_TITLE_ATTEMPTS = 2;

export interface TitleRequest {
    browserWindow: BrowserWindow;
    conversationId: string;
    model: LanguageModel;
    uiLanguageCode: string;
    contentLanguageCode: string;
}

/** Titles run in the background after the answer is saved, so they can never hold it back. */
export class ConversationTitles {
    private readonly pending = new Map<string, AbortController>();
    private readonly failedAttempts = new Map<string, number>();

    schedule(request: TitleRequest): void {
        if (this.pending.has(request.conversationId)) return;
        void this.generate(request).catch((error: unknown) => {
            log.warn('AI title update failed', {
                conversationId: request.conversationId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
    }

    abort(conversationId: string): void {
        this.pending.get(conversationId)?.abort();
        this.pending.delete(conversationId);
    }

    abortAll(): void {
        for (const conversationId of [...this.pending.keys()]) {
            this.abort(conversationId);
        }
    }

    private async generate(request: TitleRequest): Promise<void> {
        const { conversationId } = request;
        const conversation = aiRepo.getConversation(conversationId);
        const messages = aiRepo.getRecentMessages(conversationId, MAX_TITLE_INPUT_MESSAGES);
        if (!conversation || !shouldGenerateTitle(messages.length, conversation.aiTitle)) return;

        const controller = new AbortController();
        this.pending.set(conversationId, controller);
        try {
            const title = await generateConversationTitle(
                request.model,
                request.uiLanguageCode,
                request.contentLanguageCode,
                messages.map((message) => ({ role: message.role, content: message.content })),
                controller.signal,
            );
            if (controller.signal.aborted || !aiRepo.getConversation(conversationId)) return;

            if (title) {
                this.applyTitle(request.browserWindow, conversationId, title);
            } else {
                this.recordFailure(conversationId);
            }
        } finally {
            if (this.pending.get(conversationId) === controller) {
                this.pending.delete(conversationId);
            }
        }
    }

    private applyTitle(browserWindow: BrowserWindow, conversationId: string, title: string): void {
        this.failedAttempts.delete(conversationId);
        sendToRenderer(browserWindow, PushChannels.aiConversationUpdated, {
            conversation: aiRepo.updateConversation(conversationId, { title, aiTitle: true }),
        });
    }

    /** `aiTitle` also means "stop titling", like a manual rename. */
    private recordFailure(conversationId: string): void {
        const attempts = (this.failedAttempts.get(conversationId) ?? 0) + 1;
        this.failedAttempts.set(conversationId, attempts);
        if (attempts < MAX_TITLE_ATTEMPTS) return;

        this.failedAttempts.delete(conversationId);
        aiRepo.updateConversation(conversationId, { aiTitle: true });
    }
}
