import { generateText } from 'ai';
import { isAbortError } from '@ai-sdk/provider-utils';
import { BrowserWindow } from 'electron';
import log from '@main/lib/logger';
import { exportHtmlToPdf } from '@main/lib/pdf-export';
import {
    buildAiConversationExportHtml,
    hasExportableConversationContent,
} from '@main/lib/ai-chat-export';
import * as aiRepo from '@main/database/repositories/ai.repository';
import * as configRepo from '@main/database/repositories/config.repository';
import { PushChannels } from '@shared/ipc.types';
import type { PdfExportResult } from '@shared/ipc.types';
import { BUILTIN_PROVIDER_IDS, resolveProviderBaseUrl } from '@shared/ai.types';
import type {
    AiConversation,
    AiConversationHistoryPage,
    AiConversationHistoryPageRequest,
    AiMessageHistoryPage,
    AiMessageHistoryPageRequest,
    AiMessage,
    AiProviderTestResult,
    AiRetryMessageRequest,
    AiRetryMessageResult,
    AiSendMessageRequest,
    AiSendMessageResult,
    AiSettings,
    AiModelLimits,
    AiRemoteModel,
} from '@shared/ai.types';
import { normalizeCustomProvider } from '@shared/ai-provider-input';
import { buildAiTools } from './tools';
import { sendToRenderer } from '@main/ipc/register';
import { resolveLanguageModel } from './provider-resolver';
import { getAiProviderCatalog } from './provider-catalog';
import { fetchProviderModels, getModelLimits } from './model-fetcher';
import { GenerationRunnerImpl } from './runners';
import { shouldGenerateTitle, generateConversationTitle } from './title-generator';
import { resolveGenerationEnvironment, type GenerationEnvironment } from './generation-environment';
import { buildGenerationPrompt, type GenerationPrompt } from './generation-prompt';
import { isLocalProvider, resolveProviderTestTimeoutMs } from './model-timeouts';

interface RunGenerationOptions {
    runner: GenerationRunnerImpl;
    browserWindow: BrowserWindow;
    conversation: AiConversation;
    generationId: string;
    assistantMessage: AiMessage;
    environment: GenerationEnvironment;
    prompt: GenerationPrompt;
    tools: ReturnType<typeof buildAiTools>;
    abortController: AbortController;
}

interface ActiveRun {
    browserWindow: BrowserWindow;
    conversationId: string;
    generationId: string;
    assistantMessageId: string;
    controller: AbortController;
}

interface BufferedAssistantText {
    browserWindow: BrowserWindow;
    conversationId: string;
    generationId: string;
    assistantMessageId: string;
    buffer: string;
    timer: ReturnType<typeof setTimeout> | null;
}

export class AiService {
    private activeRuns = new Map<string, ActiveRun>();
    private pendingTitleRuns = new Map<string, AbortController>();
    private bufferedAssistantText = new Map<string, BufferedAssistantText>();
    private static readonly TEXT_FLUSH_INTERVAL_MS = 40;
    private static readonly TEXT_FLUSH_THRESHOLD_CHARS = 160;

    // ── Settings & catalog ──

    getSettings(): AiSettings {
        return aiRepo.ensureSettings();
    }

    getProviderCatalog() {
        return getAiProviderCatalog();
    }

    updateSettings(partial: Partial<AiSettings>): AiSettings {
        const settings = aiRepo.updateSettings(
            partial.customProviders
                ? {
                      ...partial,
                      customProviders: this.validateCustomProviders(partial.customProviders),
                  }
                : partial,
        );
        aiRepo.trimConversationHistory(settings.maxHistoryConversations);
        return settings;
    }

    // ── Conversations ──

    getConversationsPage(request: AiConversationHistoryPageRequest): AiConversationHistoryPage {
        return aiRepo.getConversationHistoryPage(request);
    }

    createConversation(input?: { title?: string }): AiConversation {
        const languageCode = configRepo.getContentLanguage();
        if (!languageCode) {
            throw new Error(
                'Aucune langue sélectionnée. Veuillez choisir une langue dans les paramètres.',
            );
        }
        return aiRepo.createConversation(languageCode, input?.title);
    }

    renameConversation(conversationId: string, title: string): AiConversation {
        const conversation = aiRepo.getConversation(conversationId);
        if (!conversation) {
            throw new Error('Conversation introuvable.');
        }

        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            throw new Error('Le nom entré est invalid');
        }

        return aiRepo.updateConversation(conversationId, {
            title: trimmedTitle.slice(0, 80),
            aiTitle: true,
        });
    }

    deleteConversation(conversationId: string): void {
        this.stopGeneration(conversationId);
        this.abortPendingTitle(conversationId);
        aiRepo.deleteConversation(conversationId);
    }

    async exportConversationPdf(
        browserWindow: BrowserWindow,
        conversationId: string,
    ): Promise<PdfExportResult> {
        const conversation = aiRepo.getConversation(conversationId);
        if (!conversation) {
            throw new Error('Conversation introuvable.');
        }

        const messages = aiRepo.getMessages(conversationId);
        if (!hasExportableConversationContent(messages)) {
            return { status: 'empty' };
        }

        const html = await buildAiConversationExportHtml(conversation, messages);
        return exportHtmlToPdf({
            html,
            defaultName: conversation.title?.trim() || `conversation-${conversation.createdAt}`,
            directory: 'ai',
            parentWindow: browserWindow,
        });
    }

    clearConversations(): void {
        for (const conversation of aiRepo.getConversations()) {
            this.stopGeneration(conversation.id);
            this.abortPendingTitle(conversation.id);
        }
        aiRepo.clearAllConversations();
    }

    getMessagesPage(request: AiMessageHistoryPageRequest): AiMessageHistoryPage {
        return aiRepo.getMessageHistoryPage(request);
    }

    // ── Generation control ──

    stopGeneration(conversationId: string): void {
        const activeRun = this.activeRuns.get(conversationId);
        if (!activeRun) {
            return;
        }

        this.flushAssistantText(activeRun.assistantMessageId);
        activeRun.controller.abort();
        this.activeRuns.delete(conversationId);
        sendToRenderer(activeRun.browserWindow, PushChannels.aiStreamCancel, {
            conversationId,
            generationId: activeRun.generationId,
            messageId: activeRun.assistantMessageId,
        });
    }

    // ── Provider testing ──

    async testProvider(input: {
        providerId: string;
        model: string;
        apiKey?: string;
        baseUrl?: string;
    }): Promise<AiProviderTestResult> {
        const settings = this.getSettings();
        const timeoutMs = resolveProviderTestTimeoutMs(
            isLocalProvider(
                input.providerId,
                input.baseUrl ?? resolveProviderBaseUrl(settings, input.providerId),
            ),
        );
        try {
            const model = resolveLanguageModel({
                settings,
                providerId: input.providerId,
                modelId: input.model,
                apiKey: input.apiKey,
                baseUrl: input.baseUrl,
            });
            await generateText({
                model,
                prompt: 'Reply with the single word OK.',
                maxOutputTokens: 20,
                timeout: { totalMs: timeoutMs },
            });
            return { valid: true };
        } catch (error) {
            if (isAbortError(error)) {
                return {
                    valid: false,
                    error: `The provider test timed out after ${timeoutMs / 1000} s.`,
                };
            }
            const message =
                error instanceof Error ? error.message : 'Validation du fournisseur impossible.';

            return {
                valid: false,
                error: message,
            };
        }
    }

    // ── Model listing ──

    async fetchProviderModels(input: {
        providerId: string;
        apiKey?: string;
        baseUrl?: string;
    }): Promise<AiRemoteModel[]> {
        return fetchProviderModels(this.getSettings(), input);
    }

    async resolveModelLimits(input: {
        providerId: string;
        model: string;
        baseUrl?: string;
    }): Promise<AiModelLimits> {
        const baseUrl =
            input.baseUrl ?? resolveProviderBaseUrl(this.getSettings(), input.providerId);
        return getModelLimits(input.providerId, input.model, baseUrl);
    }

    // ── Message sending ──

    async sendMessage(
        browserWindow: BrowserWindow,
        request: AiSendMessageRequest,
    ): Promise<AiSendMessageResult> {
        const trimmedMessages = request.messages
            .map((message) => message.trim())
            .filter((message) => message.length > 0);
        if (trimmedMessages.length === 0) {
            throw new Error('Le message ne peut pas être vide.');
        }

        const environment = await resolveGenerationEnvironment(this.getSettings());
        const conversation =
            aiRepo.getConversation(request.conversationId) ?? this.createConversation();

        this.stopGeneration(conversation.id);
        const userMessages = trimmedMessages.map((content) =>
            aiRepo.createMessage({
                conversationId: conversation.id,
                role: 'user',
                content,
            }),
        );
        const assistantMessage = aiRepo.createMessage({
            conversationId: conversation.id,
            role: 'assistant',
            content: '',
        });

        if (!conversation.title) {
            aiRepo.updateConversation(conversation.id, {
                title: trimmedMessages[0].slice(0, 80),
            });
        }

        this.startConversationGeneration(
            browserWindow,
            conversation,
            request.generationId,
            assistantMessage,
            environment,
        );

        return {
            generationId: request.generationId,
            conversation: aiRepo.getConversation(conversation.id)!,
            userMessages,
            assistantMessage,
        };
    }

    async retryMessage(
        browserWindow: BrowserWindow,
        request: AiRetryMessageRequest,
    ): Promise<AiRetryMessageResult> {
        const environment = await resolveGenerationEnvironment(this.getSettings());
        const conversation = aiRepo.getConversation(request.conversationId);
        if (!conversation) {
            throw new Error('Conversation introuvable.');
        }

        const messages = aiRepo.getMessages(conversation.id);
        const userMessageIndex = messages.findIndex(
            (message) => message.id === request.lastUserMessageId,
        );
        const userMessage = messages[userMessageIndex];
        const trailingMessages = messages.slice(userMessageIndex + 1);
        const canRetry =
            userMessage?.role === 'user' &&
            trailingMessages.every(
                (message) => message.role === 'assistant' && !message.content.trim(),
            );

        if (!canRetry) {
            throw new Error(
                'La relance est disponible uniquement pour le dernier message utilisateur.',
            );
        }

        this.stopGeneration(conversation.id);
        for (const message of trailingMessages) {
            aiRepo.deleteMessage(message.id);
        }

        const assistantMessage = aiRepo.createMessage({
            conversationId: conversation.id,
            role: 'assistant',
            content: '',
        });

        this.startConversationGeneration(
            browserWindow,
            conversation,
            request.generationId,
            assistantMessage,
            environment,
        );

        return {
            generationId: request.generationId,
            conversation: aiRepo.getConversation(conversation.id)!,
            assistantMessage,
        };
    }

    // ── Lifecycle ──

    dispose(): void {
        for (const conversationId of this.activeRuns.keys()) {
            this.stopGeneration(conversationId);
        }
        for (const conversationId of this.pendingTitleRuns.keys()) {
            this.abortPendingTitle(conversationId);
        }
        for (const messageId of this.bufferedAssistantText.keys()) {
            this.clearAssistantTextTimer(messageId);
        }
    }

    // ── Private ──

    private validateCustomProviders(
        providers: AiSettings['customProviders'],
    ): AiSettings['customProviders'] {
        const reservedIds = new Set<string>(BUILTIN_PROVIDER_IDS as readonly string[]);
        const seen = new Set<string>();
        for (const provider of providers) {
            if (reservedIds.has(provider.id)) {
                throw new Error(
                    `Custom provider id "${provider.id}" conflicts with a builtin provider.`,
                );
            }
            if (seen.has(provider.id)) {
                throw new Error(`Duplicate custom provider id: "${provider.id}".`);
            }
            if (!provider.defaultModel?.trim()) {
                throw new Error(
                    `Le modèle par défaut est requis pour le fournisseur "${provider.name}".`,
                );
            }
            seen.add(provider.id);
        }
        return providers.map(normalizeCustomProvider);
    }

    private startConversationGeneration(
        browserWindow: BrowserWindow,
        conversation: AiConversation,
        generationId: string,
        assistantMessage: AiMessage,
        environment: GenerationEnvironment,
    ): void {
        const controller = new AbortController();
        const tools = buildAiTools(environment.contentLanguageCode, {
            model: environment.model,
            uiLanguage: environment.uiLanguageCode,
            activeBibleVersion: environment.activeBibleVersion,
            maxOutputTokens: environment.modelLimits.maxOutputTokens,
            abortSignal: controller.signal,
            browserWindow,
            conversationId: conversation.id,
            generationId,
            assistantMessageId: assistantMessage.id,
        });

        const prompt = buildGenerationPrompt(conversation.id, environment, tools);
        const runner = new GenerationRunnerImpl();

        this.activeRuns.set(conversation.id, {
            browserWindow,
            conversationId: conversation.id,
            generationId,
            assistantMessageId: assistantMessage.id,
            controller,
        });

        log.info('AI generation starting', {
            providerId: environment.providerId,
            modelId: environment.modelId,
            conversationId: conversation.id,
            modelContextWindow: environment.modelLimits.contextWindow ?? 'unknown',
            modelMaxOutputTokens: environment.modelLimits.maxOutputTokens ?? 'unknown',
            historyTokenBudget: prompt.budget.historyBudget,
            answerTokens: prompt.budget.answerTokens,
            promptLimit: prompt.budget.promptLimit,
            ...prompt.stats,
        });

        void this.runGeneration({
            runner,
            browserWindow,
            conversation,
            generationId,
            assistantMessage,
            environment,
            prompt,
            tools,
            abortController: controller,
        });
    }

    private async runGeneration(opts: RunGenerationOptions): Promise<void> {
        const {
            runner,
            browserWindow,
            conversation,
            generationId,
            assistantMessage,
            environment,
            prompt,
            tools,
            abortController,
        } = opts;
        const { model, contentLanguageCode, uiLanguageCode } = environment;
        const abortSignal = abortController.signal;
        const isCurrentRun = () =>
            this.isCurrentRun(conversation.id, generationId, assistantMessage.id);

        try {
            const outcome = await runner.run({
                browserWindow,
                conversationId: conversation.id,
                generationId,
                assistantMessageId: assistantMessage.id,
                model,
                systemPrompt: prompt.systemPrompt,
                history: prompt.history,
                tools,
                abortSignal,
                isCurrentRun: (_generationId, assistantMessageId) => {
                    return this.isCurrentRun(conversation.id, generationId, assistantMessageId);
                },
                dispatchTextDelta: (delta) => {
                    return this.queueAssistantText(
                        browserWindow,
                        conversation.id,
                        generationId,
                        assistantMessage.id,
                        delta,
                    );
                },
                budget: prompt.budget,
                fixedPromptTokens: prompt.fixedPromptTokens,
                reasoningControl: environment.reasoningControl,
                timeouts: environment.timeouts,
            });

            this.flushAssistantText(assistantMessage.id);
            if (!isCurrentRun()) {
                return;
            }

            // Orders the conversation list by when its last reply finished, not when it started.
            aiRepo.touchConversation(conversation.id);
            this.releaseRun(conversation.id, generationId);
            sendToRenderer(browserWindow, PushChannels.aiStreamComplete, {
                conversationId: conversation.id,
                generationId,
                messageId: assistantMessage.id,
                outcome,
            });

            const current = aiRepo.getConversation(conversation.id);

            const MAX_TITLE_INPUT_MESSAGES = 20;
            const titleMessages = aiRepo.getRecentMessages(
                conversation.id,
                MAX_TITLE_INPUT_MESSAGES,
            );
            if (current && shouldGenerateTitle(titleMessages.length, current.aiTitle)) {
                await this.runTitleGeneration({
                    browserWindow,
                    conversationId: conversation.id,
                    abortController,
                    model,
                    uiLanguageCode,
                    contentLanguageCode,
                    messages: titleMessages.map((message) => ({
                        role: message.role,
                        content: message.content,
                    })),
                });
            }
        } catch (error) {
            this.flushAssistantText(assistantMessage.id);
            const message = error instanceof Error ? error.message : 'AI generation failed.';
            const wasAborted = abortSignal.aborted || isAbortError(error);
            if (wasAborted || !isCurrentRun()) {
                return;
            }

            this.releaseRun(conversation.id, generationId);
            log.error('AI generation failed', {
                conversationId: conversation.id,
                message,
            });
            sendToRenderer(browserWindow, PushChannels.aiStreamError, {
                conversationId: conversation.id,
                generationId,
                messageId: assistantMessage.id,
                error: message,
            });
        } finally {
            try {
                this.flushAssistantText(assistantMessage.id);
                this.finalizeAssistantMessage(assistantMessage.id, {
                    removeIfEmpty: true,
                });
            } catch {
                // DB may already be closed during app shutdown
            }
            this.releaseRun(conversation.id, generationId);
        }
    }

    private isCurrentRun(
        conversationId: string,
        generationId: string,
        assistantMessageId: string,
    ): boolean {
        const activeRun = this.activeRuns.get(conversationId);
        return (
            activeRun?.generationId === generationId &&
            activeRun.assistantMessageId === assistantMessageId
        );
    }

    private releaseRun(conversationId: string, generationId: string): void {
        const activeRun = this.activeRuns.get(conversationId);
        if (activeRun?.generationId === generationId) {
            this.activeRuns.delete(conversationId);
        }
    }

    private abortPendingTitle(conversationId: string): void {
        this.pendingTitleRuns.get(conversationId)?.abort();
        this.pendingTitleRuns.delete(conversationId);
    }

    /** Tracked separately so it stays cancellable once the generation itself is released. */
    private async runTitleGeneration(opts: {
        browserWindow: BrowserWindow;
        conversationId: string;
        abortController: AbortController;
        model: ReturnType<typeof resolveLanguageModel>;
        uiLanguageCode: string;
        contentLanguageCode: string;
        messages: { role: string; content: string }[];
    }): Promise<void> {
        const { conversationId, abortController } = opts;
        this.pendingTitleRuns.set(conversationId, abortController);

        try {
            const title = await generateConversationTitle(
                opts.model,
                opts.uiLanguageCode,
                opts.contentLanguageCode,
                opts.messages,
                abortController.signal,
            );

            if (
                !title ||
                abortController.signal.aborted ||
                !aiRepo.getConversation(conversationId)
            ) {
                return;
            }

            sendToRenderer(opts.browserWindow, PushChannels.aiConversationUpdated, {
                conversation: aiRepo.updateConversation(conversationId, { title, aiTitle: true }),
            });
        } finally {
            if (this.pendingTitleRuns.get(conversationId) === abortController) {
                this.pendingTitleRuns.delete(conversationId);
            }
        }
    }

    private finalizeAssistantMessage(
        messageId: string,
        options?: { removeIfEmpty?: boolean },
    ): void {
        const message = aiRepo.getMessage(messageId);
        if (!message) {
            return;
        }

        const isEmpty =
            !message.content.trim() &&
            message.toolCalls.length === 0 &&
            message.toolResults.length === 0;

        if (options?.removeIfEmpty && isEmpty) {
            aiRepo.deleteMessage(messageId);
            return;
        }

        aiRepo.syncMessage(messageId);
    }

    private queueAssistantText(
        browserWindow: BrowserWindow,
        conversationId: string,
        generationId: string,
        assistantMessageId: string,
        delta: string,
    ): void {
        if (!delta) {
            return;
        }

        const current =
            this.bufferedAssistantText.get(assistantMessageId) ??
            ({
                browserWindow,
                conversationId,
                generationId,
                assistantMessageId,
                buffer: '',
                timer: null,
            } satisfies BufferedAssistantText);

        current.buffer += delta;
        this.bufferedAssistantText.set(assistantMessageId, current);

        if (current.buffer.length >= AiService.TEXT_FLUSH_THRESHOLD_CHARS) {
            this.flushAssistantText(assistantMessageId);
            return;
        }

        if (current.timer) {
            return;
        }

        current.timer = setTimeout(() => {
            this.flushAssistantText(assistantMessageId);
        }, AiService.TEXT_FLUSH_INTERVAL_MS);
    }

    private flushAssistantText(assistantMessageId: string): void {
        const current = this.bufferedAssistantText.get(assistantMessageId);
        if (!current) {
            return;
        }

        this.clearAssistantTextTimer(assistantMessageId);

        if (!current.buffer) {
            this.bufferedAssistantText.delete(assistantMessageId);
            return;
        }

        if (
            !this.isCurrentRun(
                current.conversationId,
                current.generationId,
                current.assistantMessageId,
            )
        ) {
            this.bufferedAssistantText.delete(assistantMessageId);
            return;
        }

        const delta = current.buffer;
        this.bufferedAssistantText.delete(assistantMessageId);
        aiRepo.appendAssistantContent(assistantMessageId, delta);
        sendToRenderer(current.browserWindow, PushChannels.aiStreamChunk, {
            conversationId: current.conversationId,
            generationId: current.generationId,
            messageId: current.assistantMessageId,
            delta,
        });
    }

    private clearAssistantTextTimer(assistantMessageId: string): void {
        const current = this.bufferedAssistantText.get(assistantMessageId);
        if (!current?.timer) {
            return;
        }

        clearTimeout(current.timer);
        current.timer = null;
    }
}
