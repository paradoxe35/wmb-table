import { generateText } from 'ai';
import { isAbortError } from '@ai-sdk/provider-utils';
import type { BrowserWindow } from 'electron';
import log from '@main/lib/logger';
import { exportHtmlToPdf } from '@main/lib/pdf-export';
import {
    buildAiConversationExportHtml,
    hasExportableConversationContent,
} from '@main/lib/ai-chat-export';
import * as aiRepo from '@main/database/repositories/ai.repository';
import * as configRepo from '@main/database/repositories/config.repository';
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
import { resolveLanguageModel } from './provider-resolver';
import { getAiProviderCatalog } from './provider-catalog';
import { fetchProviderModels, getModelLimits } from './model-fetcher';
import { GenerationRunnerImpl } from './runners';
import { ConversationTitles } from './conversation-titles';
import { ChatRuns, unsavedReply, type ChatRun } from './chat-runs';
import { scrubSecrets } from './ai-errors';
import { resolveGenerationEnvironment, type GenerationEnvironment } from './generation-environment';
import { buildGenerationPrompt, type GenerationPrompt } from './generation-prompt';
import {
    AI_TIMEOUT_MESSAGE,
    isLocalProvider,
    resolveProviderTestTimeoutMs,
} from './model-timeouts';

interface RunGenerationOptions {
    run: ChatRun;
    runner: GenerationRunnerImpl;
    conversation: AiConversation;
    assistantMessage: AiMessage;
    environment: GenerationEnvironment;
    prompt: GenerationPrompt;
    tools: ReturnType<typeof buildAiTools>;
}

export class AiService {
    private readonly runs = new ChatRuns();
    private readonly titles = new ConversationTitles();

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
        this.titles.abort(conversationId);
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
            this.titles.abort(conversation.id);
        }
        aiRepo.clearAllConversations();
    }

    getMessagesPage(request: AiMessageHistoryPageRequest): AiMessageHistoryPage {
        return aiRepo.getMessageHistoryPage(request);
    }

    // ── Generation control ──

    stopGeneration(conversationId: string): void {
        this.runs.stop(conversationId);
    }

    stopGenerationsForWindow(browserWindow: BrowserWindow): void {
        this.runs.stopWindow(browserWindow);
    }

    /** Empty reply rows left by a crash; rows of a live run are newer than its start. */
    removeAbandonedReplies(): void {
        const removed = aiRepo.deleteEmptyAssistantMessages(this.runs.earliestStart());
        if (removed > 0) {
            log.info('Removed empty AI replies left by an earlier session', { removed });
        }
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
                return { valid: false, error: AI_TIMEOUT_MESSAGE };
            }
            const message = scrubSecrets(
                error instanceof Error ? error.message : 'Validation du fournisseur impossible.',
            );

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

        const run = this.runs.begin(browserWindow, request.conversationId, request.generationId);
        try {
            const environment = await this.runs.untilStopped(
                run,
                resolveGenerationEnvironment(this.getSettings()),
            );
            const conversation =
                aiRepo.getConversation(request.conversationId) ?? this.createConversation();
            if (environment) this.runs.moveTo(run, conversation.id);

            const userMessages = trimmedMessages.map((content) =>
                aiRepo.createMessage({ conversationId: conversation.id, role: 'user', content }),
            );
            if (!conversation.title) {
                aiRepo.updateConversation(conversation.id, {
                    title: trimmedMessages[0].slice(0, 80),
                });
            }

            const assistantMessage = environment
                ? this.startConversationGeneration(run, conversation, environment)
                : unsavedReply(conversation.id);

            return {
                generationId: request.generationId,
                conversation: aiRepo.getConversation(conversation.id)!,
                userMessages,
                assistantMessage,
            };
        } catch (error) {
            this.runs.release(run);
            throw error;
        }
    }

    async retryMessage(
        browserWindow: BrowserWindow,
        request: AiRetryMessageRequest,
    ): Promise<AiRetryMessageResult> {
        const conversation = aiRepo.getConversation(request.conversationId);
        if (!conversation) {
            throw new Error('Conversation introuvable.');
        }
        const trailingMessages = this.findRetryableTrail(
            conversation.id,
            request.lastUserMessageId,
        );

        const run = this.runs.begin(browserWindow, conversation.id, request.generationId);
        try {
            const environment = await this.runs.untilStopped(
                run,
                resolveGenerationEnvironment(this.getSettings()),
            );
            if (environment) {
                for (const message of trailingMessages) {
                    aiRepo.deleteMessage(message.id);
                }
            }

            return {
                generationId: request.generationId,
                conversation: aiRepo.getConversation(conversation.id)!,
                assistantMessage: environment
                    ? this.startConversationGeneration(run, conversation, environment)
                    : unsavedReply(conversation.id),
            };
        } catch (error) {
            this.runs.release(run);
            throw error;
        }
    }

    // ── Lifecycle ──

    /** Saves every partial reply, so the database can close right after. */
    dispose(): void {
        this.runs.stopAll();
        this.titles.abortAll();
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

    private findRetryableTrail(conversationId: string, lastUserMessageId: string): AiMessage[] {
        const messages = aiRepo.getMessages(conversationId);
        const userMessageIndex = messages.findIndex((message) => message.id === lastUserMessageId);
        const trailingMessages = messages.slice(userMessageIndex + 1);
        const canRetry =
            messages[userMessageIndex]?.role === 'user' &&
            trailingMessages.every(
                (message) => message.role === 'assistant' && !message.content.trim(),
            );

        if (!canRetry) {
            throw new Error(
                'La relance est disponible uniquement pour le dernier message utilisateur.',
            );
        }
        return trailingMessages;
    }

    private startConversationGeneration(
        run: ChatRun,
        conversation: AiConversation,
        environment: GenerationEnvironment,
    ): AiMessage {
        const assistantMessage = aiRepo.createMessage({
            conversationId: conversation.id,
            role: 'assistant',
            content: '',
        });
        this.runs.attachReply(run, assistantMessage.id);

        const tools = buildAiTools(environment.contentLanguageCode, {
            model: environment.model,
            uiLanguage: environment.uiLanguageCode,
            activeBibleVersion: environment.activeBibleVersion,
            contextWindow: environment.modelLimits.contextWindow,
            maxOutputTokens: environment.modelLimits.maxOutputTokens,
            timeouts: environment.timeouts,
            reasoningControl: environment.reasoningControl,
            abortSignal: run.controller.signal,
            browserWindow: run.browserWindow,
            conversationId: conversation.id,
            generationId: run.generationId,
            assistantMessageId: assistantMessage.id,
        });
        const prompt = buildGenerationPrompt(conversation.id, environment, tools);

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
            run,
            runner: new GenerationRunnerImpl(),
            conversation,
            assistantMessage,
            environment,
            prompt,
            tools,
        });
        return assistantMessage;
    }

    private async runGeneration(opts: RunGenerationOptions): Promise<void> {
        const { run, runner, conversation, assistantMessage, environment, prompt, tools } = opts;

        try {
            const outcome = await runner.run({
                browserWindow: run.browserWindow,
                conversationId: conversation.id,
                generationId: run.generationId,
                assistantMessageId: assistantMessage.id,
                model: environment.model,
                systemPrompt: prompt.systemPrompt,
                history: prompt.history,
                tools,
                abortSignal: run.controller.signal,
                isCurrentRun: (generationId, assistantMessageId) =>
                    this.runs.isCurrentReply(conversation.id, generationId, assistantMessageId),
                dispatchTextDelta: (delta) => this.runs.queueText(run, delta),
                budget: prompt.budget,
                fixedPromptTokens: prompt.fixedPromptTokens,
                reasoningControl: environment.reasoningControl,
                timeouts: environment.timeouts,
            });
            if (!this.runs.complete(run, outcome)) return;
        } catch (error) {
            this.runs.fail(run, error);
            return;
        }

        this.titles.schedule({
            browserWindow: run.browserWindow,
            conversationId: conversation.id,
            model: environment.model,
            uiLanguageCode: environment.uiLanguageCode,
            contentLanguageCode: environment.contentLanguageCode,
        });
    }
}
