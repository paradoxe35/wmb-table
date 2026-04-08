import { generateText } from 'ai';
import { BrowserWindow } from 'electron';
import log from '@main/lib/logger';
import * as aiRepo from '@main/database/repositories/ai.repository';
import * as configRepo from '@main/database/repositories/config.repository';
import * as languagePackService from '@main/services/language-pack.service';
import { PushChannels } from '@shared/ipc.types';
import { BUILTIN_PROVIDER_IDS } from '@shared/ai.types';
import type {
    AiConversation,
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

export class AiService {
    private activeRuns = new Map<string, ActiveRun>();
    private localRuntime = new LocalRuntimeService();

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

    deleteConversation(conversationId: string): void {
        this.stopGeneration(conversationId);
        aiRepo.deleteConversation(conversationId);
    }

    clearConversations(): void {
        for (const conversation of aiRepo.getConversations()) {
            this.stopGeneration(conversation.id);
        }
        aiRepo.clearAllConversations();
    }

    getMessages(conversationId: string): AiMessage[] {
        return aiRepo.getMessages(conversationId);
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

        const conversation =
            aiRepo.getConversation(request.conversationId) ?? this.createConversation();
        const userMessage = aiRepo.createMessage({
            conversationId: conversation.id,
            role: 'user',
            content: request.content.trim(),
        });
        const assistantMessage = aiRepo.createMessage({
            conversationId: conversation.id,
            role: 'assistant',
            content: '',
        });

        if (!conversation.title) {
            aiRepo.updateConversation(conversation.id, {
                title: request.content.trim().slice(0, 80),
            });
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

        this.stopGeneration(conversation.id);
        const controller = new AbortController();
        this.activeRuns.set(conversation.id, {
            browserWindow,
            conversationId: conversation.id,
            generationId: request.generationId,
            assistantMessageId: assistantMessage.id,
            controller,
        });

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

        const installedLanguages = await languagePackService.getInstalledLanguages();
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
            userMessage,
            assistantMessage,
        };
    }

    // ── Lifecycle ──

    dispose(): void {
        for (const conversationId of this.activeRuns.keys()) {
            this.stopGeneration(conversationId);
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
                contextWindow,
                toolTokens,
                systemPromptTokens,
            });

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
            const allMessages = aiRepo.getMessages(conversation.id);
            if (current && shouldGenerateTitle(allMessages.length, current.aiTitle)) {
                const title = await generateConversationTitle(
                    model,
                    uiLanguageCode,
                    contentLanguageCode,
                    allMessages.map((m) => ({ role: m.role, content: m.content })),
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
