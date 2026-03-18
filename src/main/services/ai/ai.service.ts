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
import { resolveActiveModel, resolveLanguageModel } from './provider-resolver';
import { getAiProviderCatalog } from './provider-catalog';
import { fetchProviderModels } from './model-fetcher';
import { GenerationRunnerImpl } from './runners';
import { shouldGenerateTitle, generateConversationTitle } from './title-generator';

export class AiService {
    private controllers = new Map<string, AbortController>();
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

    createConversation(input?: { title?: string; languageCode?: string }): AiConversation {
        const languageCode = input?.languageCode ?? configRepo.getActiveLanguage() ?? 'fr';
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
        this.controllers.get(conversationId)?.abort();
        this.controllers.delete(conversationId);
    }

    // ── Provider testing ──

    async testProvider(input: {
        providerId: string;
        model: string;
        apiKey?: string;
        baseUrl?: string;
    }): Promise<AiProviderTestResult> {
        try {
            const model = resolveLanguageModel({
                settings: this.getSettings(),
                providerId: input.providerId,
                modelId: input.model,
                defaultLanguageCode: configRepo.getActiveLanguage() ?? 'fr',
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
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Provider validation failed.',
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
            aiRepo.getConversation(request.conversationId) ??
            this.createConversation({ languageCode: request.overrideLanguageCode });
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

        const activeLanguageCode = request.overrideLanguageCode ?? conversation.languageCode;
        const isLocal = providerId === 'local';

        const installedLanguages = await languagePackService.getInstalledLanguages();
        const { recentMessages, summary } = buildConversationContext(conversation.id, isLocal);
        const system = buildSystemPrompt({
            activeLanguageCode,
            overrideLanguageCode: request.overrideLanguageCode,
            installedLanguages,
            languagePreference: settings.languagePreference,
            hasAgents: !isLocal,
        });
        const systemPrompt = summary ? `${system}\n\nConversation memory:\n${summary}` : system;
        const model = resolveLanguageModel({
            settings,
            providerId,
            modelId,
            defaultLanguageCode: activeLanguageCode,
            localRuntime: this.localRuntime,
        });

        this.stopGeneration(conversation.id);
        const controller = new AbortController();
        this.controllers.set(conversation.id, controller);

        const tools = buildAiTools(activeLanguageCode, {
            model,
            isLocal,
            abortSignal: controller.signal,
            browserWindow,
            conversationId: conversation.id,
            assistantMessageId: assistantMessage.id,
        });

        const runner = new GenerationRunnerImpl(isLocal);

        log.info('AI generation starting', {
            providerId,
            modelId,
            conversationId: conversation.id,
        });

        void this.runGeneration(
            runner,
            browserWindow,
            conversation,
            assistantMessage,
            model,
            systemPrompt,
            recentMessages,
            tools,
            controller.signal,
            isLocal,
            activeLanguageCode,
        );

        return {
            conversation: aiRepo.getConversation(conversation.id)!,
            userMessage,
            assistantMessage,
        };
    }

    // ── Lifecycle ──

    dispose(): void {
        for (const conversationId of this.controllers.keys()) {
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

    private async runGeneration(
        runner: GenerationRunnerImpl,
        browserWindow: BrowserWindow,
        conversation: AiConversation,
        assistantMessage: AiMessage,
        model: ReturnType<typeof resolveLanguageModel>,
        systemPrompt: string,
        history: ReturnType<typeof buildConversationContext>['recentMessages'],
        tools: ReturnType<typeof buildAiTools>,
        abortSignal: AbortSignal,
        isLocal: boolean,
        activeLanguageCode: string,
    ): Promise<void> {
        try {
            await runner.run({
                browserWindow,
                conversationId: conversation.id,
                assistantMessageId: assistantMessage.id,
                model,
                systemPrompt,
                history,
                tools,
                abortSignal,
            });

            const nextContext = buildConversationContext(conversation.id, isLocal);
            aiRepo.updateConversation(conversation.id, {
                summary: nextContext.summary,
                languageCode: activeLanguageCode,
            });
            sendToRenderer(browserWindow, PushChannels.aiStreamComplete, {
                conversationId: conversation.id,
                messageId: assistantMessage.id,
            });

            // Generate an AI title after the first complete exchange
            const allMessages = aiRepo.getMessages(conversation.id);
            if (shouldGenerateTitle(allMessages.length)) {
                const title = await generateConversationTitle(
                    model,
                    allMessages.map((m) => ({ role: m.role, content: m.content })),
                );
                if (title) {
                    const updated = aiRepo.updateConversation(conversation.id, { title });
                    sendToRenderer(browserWindow, PushChannels.aiConversationUpdated, {
                        conversation: updated,
                    });
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'AI generation failed.';
            log.error('AI generation failed', {
                conversationId: conversation.id,
                message,
            });
            sendToRenderer(browserWindow, PushChannels.aiStreamError, {
                conversationId: conversation.id,
                messageId: assistantMessage.id,
                error: message,
            });
        } finally {
            aiRepo.syncMessage(assistantMessage.id);
            this.controllers.delete(conversation.id);
        }
    }
}
