import { generateText } from 'ai';
import { BrowserWindow } from 'electron';
import log from '@main/lib/logger';
import { exportHtmlToPdf } from '@main/lib/pdf-export';
import {
    buildAiConversationExportHtml,
    hasExportableConversationContent,
} from '@main/lib/ai-chat-export';
import * as aiRepo from '@main/database/repositories/ai.repository';
import * as configRepo from '@main/database/repositories/config.repository';
import * as languagePackService from '@main/services/language-pack.service';
import { PushChannels } from '@shared/ipc.types';
import type { PdfExportResult } from '@shared/ipc.types';
import { BUILTIN_PROVIDER_IDS } from '@shared/ai.types';
import type {
    AiConversation,
    AiMessageHistoryPage,
    AiMessageHistoryPageRequest,
    AiMessage,
    AiProviderTestResult,
    AiSendMessageRequest,
    AiSendMessageResult,
    AiSettings,
    AiRemoteModel,
} from '@shared/ai.types';
import { buildSystemPrompt } from './system-prompt';
import { scanLocalModels } from './local/local-model.service';
import { downloadLocalModel } from './local/model-download.service';
import { LocalRuntimeService } from './local/local-runtime.service';
import { buildAiTools } from './tools';
import { sendToRenderer } from '@main/ipc/register';
import { buildConversationContext } from './context-memory';
import {
    calculateRemoteTokenBudget,
    MIN_REMOTE_CONTEXT_WINDOW,
    measurePromptTokens,
    measureToolTokens,
} from './token-budget';
import { resolveActiveModel, resolveLanguageModel } from './provider-resolver';
import { getAiProviderCatalog } from './provider-catalog';
import { fetchProviderModels, getModelContextWindow } from './model-fetcher';
import { GenerationRunnerImpl } from './runners';
import { shouldGenerateTitle, generateConversationTitle } from './title-generator';
import { resolveUiLanguage } from '@shared/constants';
import * as bibleService from '@main/services/bible.service';

interface RunGenerationOptions {
    runner: GenerationRunnerImpl;
    browserWindow: BrowserWindow;
    conversation: AiConversation;
    generationId: string;
    assistantMessage: AiMessage;
    model: ReturnType<typeof resolveLanguageModel>;
    systemPrompt: string;
    history: ReturnType<typeof buildConversationContext>['recentMessages'];
    tools: ReturnType<typeof buildAiTools>;
    abortSignal: AbortSignal;
    isLocal: boolean;
    remoteTokenBudget?: number;
    contextWindow?: number;
    toolTokens: number;
    systemPromptTokens: number;
    contentLanguageCode: string;
    uiLanguageCode: string;
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
    private bufferedAssistantText = new Map<string, BufferedAssistantText>();
    private localRuntime = new LocalRuntimeService();
    private static readonly TEXT_FLUSH_INTERVAL_MS = 40;
    private static readonly TEXT_FLUSH_THRESHOLD_CHARS = 160;

    // ── Settings & catalog ──

    getSettings(): AiSettings {
        const settings = aiRepo.ensureSettings();
        this.localRuntime.setGpuEnabled(settings.providers.local.gpuEnabled ?? false);
        return settings;
    }

    getProviderCatalog() {
        return getAiProviderCatalog();
    }

    updateSettings(partial: Partial<AiSettings>): AiSettings {
        if (partial.customProviders) {
            this.validateCustomProviders(partial.customProviders);
        }
        const settings = aiRepo.updateSettings(partial);
        aiRepo.trimConversationHistory(settings.maxHistoryConversations);
        this.localRuntime.setGpuEnabled(settings.providers.local.gpuEnabled ?? false);
        return settings;
    }

    // ── Conversations ──

    getConversations(): AiConversation[] {
        return aiRepo.getConversations();
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
            defaultName: this.getConversationPdfName(conversation),
            directory: 'ai',
            parentWindow: browserWindow,
        });
    }

    clearConversations(): void {
        for (const conversation of aiRepo.getConversations()) {
            this.stopGeneration(conversation.id);
        }
        aiRepo.clearAllConversations();
    }

    getMessagesPage(request: AiMessageHistoryPageRequest): AiMessageHistoryPage {
        return aiRepo.getMessageHistoryPage(request);
    }

    // ── Local models ──

    async scanLocalModels() {
        return scanLocalModels();
    }

    async downloadModel(browserWindow: BrowserWindow, modelId: string): Promise<void> {
        await downloadLocalModel(browserWindow, modelId);
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
        try {
            const defaultLanguage = configRepo.getContentLanguage();
            if (!defaultLanguage) {
                throw new Error(
                    'Aucune langue sélectionnée. Veuillez choisir une langue dans les paramètres.',
                );
            }

            const model = resolveLanguageModel({
                settings: this.getSettings(),
                providerId: input.providerId,
                modelId: input.model,
                defaultContentLanguage: defaultLanguage,
                localRuntime: this.localRuntime,
                apiKey: input.apiKey,
                baseUrl: input.baseUrl,
            });
            await generateText({
                model,
                prompt: 'Reply with the single word OK.',
                maxOutputTokens: 20,
            });
            return { valid: true };
        } catch (error) {
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

    // ── Message sending ──

    async sendMessage(
        browserWindow: BrowserWindow,
        request: AiSendMessageRequest,
    ): Promise<AiSendMessageResult> {
        const settings = this.getSettings();
        if (!settings.enabled) {
            throw new Error("L'assistant IA est désactivé dans les paramètres.");
        }

        const providerId = settings.activeProvider;
        if (!providerId) {
            throw new Error(
                'Aucun fournisseur IA configuré. Sélectionnez un fournisseur dans les paramètres.',
            );
        }
        const modelId = resolveActiveModel(settings);
        if (!modelId) {
            throw new Error(
                'Aucun modèle configuré pour ce fournisseur. Définissez un modèle dans les paramètres.',
            );
        }

        const trimmedMessages = request.messages
            .map((message) => message.trim())
            .filter((message) => message.length > 0);
        if (trimmedMessages.length === 0) {
            throw new Error('Le message ne peut pas être vide.');
        }

        const contentLanguageCode = configRepo.getContentLanguage();
        if (!contentLanguageCode) {
            throw new Error(
                'Aucune langue sélectionnée. Veuillez choisir une langue dans les paramètres.',
            );
        }
        const uiLanguageCode = resolveUiLanguage(configRepo.getUiLanguage(), contentLanguageCode);

        const isLocal = providerId === 'local';
        const activeBibleVersion = bibleService.getActiveVersion()?.abbreviation;

        const providerBaseUrl = settings.customProviders.find(
            (provider) => provider.id === providerId,
        )?.baseUrl;
        const contextWindow = isLocal
            ? undefined
            : await getModelContextWindow(providerId, modelId, providerBaseUrl);

        const smallContext =
            !isLocal && contextWindow != null && contextWindow < MIN_REMOTE_CONTEXT_WINDOW;
        const hasAgents = !isLocal && !smallContext;

        if (smallContext) {
            log.warn('Small context window detected — agents disabled', {
                providerId,
                modelId,
                contextWindow,
                minRequired: MIN_REMOTE_CONTEXT_WINDOW,
            });
        }

        const model = resolveLanguageModel({
            settings,
            providerId,
            modelId,
            defaultContentLanguage: contentLanguageCode,
            localRuntime: this.localRuntime,
        });

        const installedLanguages = await languagePackService.getInstalledLanguages();
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

        const controller = new AbortController();

        const tools = buildAiTools(contentLanguageCode, {
            model,
            isLocal: isLocal || smallContext,
            uiLanguage: uiLanguageCode,
            activeBibleVersion,
            abortSignal: controller.signal,
            browserWindow,
            conversationId: conversation.id,
            generationId: request.generationId,
            assistantMessageId: assistantMessage.id,
        });

        const system = buildSystemPrompt({
            contentLanguageCode,
            uiLanguageCode,
            installedLanguages,
            languagePreference: settings.languagePreference,
            activeBibleVersion,
            hasAgents,
        });
        const toolTokens = measureToolTokens(tools);
        const baseSystemPromptTokens = measurePromptTokens(system);
        const initialRemoteTokenBudget = calculateRemoteTokenBudget(contextWindow, {
            toolTokens,
            systemPromptTokens: baseSystemPromptTokens,
        });
        const { recentMessages, summary } = buildConversationContext(
            conversation.id,
            isLocal,
            initialRemoteTokenBudget,
        );
        const systemPrompt = summary ? `${system}\n\nConversation memory:\n${summary}` : system;
        const systemPromptTokens = measurePromptTokens(systemPrompt);
        const remoteTokenBudget = calculateRemoteTokenBudget(contextWindow, {
            toolTokens,
            systemPromptTokens,
        });

        const runner = new GenerationRunnerImpl(isLocal);

        this.activeRuns.set(conversation.id, {
            browserWindow,
            conversationId: conversation.id,
            generationId: request.generationId,
            assistantMessageId: assistantMessage.id,
            controller,
        });

        log.info('AI generation starting', {
            providerId,
            modelId,
            conversationId: conversation.id,
            contextWindow: contextWindow ?? 'unknown',
            tokenBudget: remoteTokenBudget,
            toolTokens,
            systemPromptTokens,
        });

        void this.runGeneration({
            runner,
            browserWindow,
            conversation,
            generationId: request.generationId,
            assistantMessage,
            model,
            systemPrompt,
            history: recentMessages,
            tools,
            abortSignal: controller.signal,
            isLocal,
            remoteTokenBudget,
            contextWindow,
            toolTokens,
            systemPromptTokens,
            contentLanguageCode,
            uiLanguageCode,
        });

        return {
            generationId: request.generationId,
            conversation: aiRepo.getConversation(conversation.id)!,
            userMessages,
            assistantMessage,
        };
    }

    // ── Lifecycle ──

    dispose(): void {
        for (const conversationId of this.activeRuns.keys()) {
            this.stopGeneration(conversationId);
        }
        for (const messageId of this.bufferedAssistantText.keys()) {
            this.clearAssistantTextTimer(messageId);
        }
        void this.localRuntime.dispose();
    }

    // ── Private ──

    private validateCustomProviders(providers: AiSettings['customProviders']): void {
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
    }

    private getConversationPdfName(conversation: AiConversation): string {
        const baseTitle = conversation.title?.trim() || 'conversation - ' + conversation.createdAt;
        return (
            baseTitle
                .toLowerCase()
                .replace(/[^\p{L}\p{N}]+/gu, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 80) || 'conversation'
        );
    }

    private async runGeneration(opts: RunGenerationOptions): Promise<void> {
        const {
            runner,
            browserWindow,
            conversation,
            generationId,
            assistantMessage,
            model,
            systemPrompt,
            history,
            tools,
            abortSignal,
            isLocal,
            remoteTokenBudget,
            contextWindow,
            toolTokens,
            systemPromptTokens,
            contentLanguageCode,
            uiLanguageCode,
        } = opts;
        const isCurrentRun = () =>
            this.isCurrentRun(conversation.id, generationId, assistantMessage.id);

        try {
            await runner.run({
                browserWindow,
                conversationId: conversation.id,
                generationId,
                assistantMessageId: assistantMessage.id,
                model,
                systemPrompt,
                history,
                tools,
                abortSignal,
                isCurrentRun: (_generationId, assistantMessageId) =>
                    this.isCurrentRun(conversation.id, generationId, assistantMessageId),
                dispatchTextDelta: (delta) =>
                    this.queueAssistantText(
                        browserWindow,
                        conversation.id,
                        generationId,
                        assistantMessage.id,
                        delta,
                    ),
                contextWindow,
                toolTokens,
                systemPromptTokens,
            });

            this.flushAssistantText(assistantMessage.id);
            if (!isCurrentRun()) {
                return;
            }

            const nextContext = buildConversationContext(
                conversation.id,
                isLocal,
                remoteTokenBudget,
            );
            aiRepo.updateConversation(conversation.id, {
                summary: nextContext.summary,
            });
            this.releaseRun(conversation.id, generationId);
            sendToRenderer(browserWindow, PushChannels.aiStreamComplete, {
                conversationId: conversation.id,
                generationId,
                messageId: assistantMessage.id,
            });

            const current = aiRepo.getConversation(conversation.id);

            const MAX_TITLE_INPUT_MESSAGES = 20;
            const recentMessages = aiRepo.getRecentMessages(
                conversation.id,
                MAX_TITLE_INPUT_MESSAGES,
            );
            if (current && shouldGenerateTitle(recentMessages.length, current.aiTitle)) {
                const title = await generateConversationTitle(
                    model,
                    uiLanguageCode,
                    contentLanguageCode,
                    recentMessages.map((message) => ({
                        role: message.role,
                        content: message.content,
                    })),
                );

                if (title) {
                    const updated = aiRepo.updateConversation(conversation.id, {
                        title,
                        aiTitle: true,
                    });
                    sendToRenderer(browserWindow, PushChannels.aiConversationUpdated, {
                        conversation: updated,
                    });
                }
            }
        } catch (error) {
            this.flushAssistantText(assistantMessage.id);
            const message = error instanceof Error ? error.message : 'AI generation failed.';
            const wasAborted = abortSignal.aborted || this.isAbortError(error);
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

    private isAbortError(error: unknown): boolean {
        if (error instanceof DOMException) {
            return error.name === 'AbortError';
        }

        if (!(error instanceof Error)) {
            return false;
        }

        return /abort(ed)?/i.test(error.message);
    }
}
