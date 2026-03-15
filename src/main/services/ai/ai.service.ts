import { generateText } from 'ai';
import { BrowserWindow } from 'electron';
import log from '@main/lib/logger';
import * as aiRepo from '@main/database/repositories/ai.repository';
import * as configRepo from '@main/database/repositories/config.repository';
import * as languagePackService from '@main/services/language-pack.service';
import { PushChannels } from '@shared/ipc.types';
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
import { resolveDefaultModel, resolveLanguageModel } from './provider-resolver';
import { getAiProviderCatalog } from './provider-catalog';
import { SimpleCache } from '@main/lib/simple-cache';
import { GenerationRunnerImpl } from './runners';

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
        const settings = this.getSettings();
        const { providerId } = input;

        if (providerId === 'local') return [];

        let baseUrl: string | undefined;
        let apiKey: string | undefined;

        const builtinConfig = settings.providers[providerId as keyof AiSettings['providers']];
        if (builtinConfig) {
            apiKey = input.apiKey ?? builtinConfig.apiKey;
        }

        const customProvider = settings.customProviders.find((p) => p.id === providerId);
        if (customProvider) {
            apiKey = input.apiKey ?? customProvider.apiKey;
            baseUrl = input.baseUrl ?? customProvider.baseUrl;
        }

        if (!apiKey) return [];

        const cacheKey = `ai-models:${providerId}`;
        const cache = new SimpleCache<AiRemoteModel[]>(cacheKey, 60 * 60 * 1000);
        const cached = cache.get();
        if (cached) return cached;

        const PROVIDER_BASE_URLS: Record<string, string> = {
            openai: 'https://api.openai.com/v1',
            openrouter: 'https://openrouter.ai/api/v1',
            gemini: 'https://generativelanguage.googleapis.com/v1beta',
            claude: 'https://api.anthropic.com/v1',
        };

        const base = baseUrl ?? PROVIDER_BASE_URLS[providerId];
        if (!base) return [];

        try {
            let models: AiRemoteModel[] = [];

            if (providerId === 'gemini') {
                const url = `${base}/models?key=${apiKey ?? ''}`;
                const res = await fetch(url);
                if (!res.ok) return cache.getStale() ?? [];
                const data = (await res.json()) as {
                    models?: { name: string; displayName: string }[];
                };
                models = (data.models ?? [])
                    .filter((m) => m.name.startsWith('models/gemini'))
                    .map((m) => ({
                        id: m.name.replace('models/', ''),
                        name: m.displayName,
                    }));
            } else if (providerId === 'claude') {
                const res = await fetch(`${base}/models`, {
                    headers: {
                        'x-api-key': apiKey ?? '',
                        'anthropic-version': '2023-06-01',
                    },
                });
                if (!res.ok) return cache.getStale() ?? [];
                const data = (await res.json()) as {
                    data?: { id: string; display_name?: string }[];
                };
                models = (data.data ?? []).map((m) => ({
                    id: m.id,
                    name: m.display_name ?? m.id,
                }));
            } else {
                const headers: Record<string, string> = {};
                if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

                const res = await fetch(`${base}/models`, { headers });
                if (!res.ok) return cache.getStale() ?? [];
                const data = (await res.json()) as {
                    data?: { id: string; name?: string }[];
                };
                models = (data.data ?? [])
                    .map((m) => ({ id: m.id, name: m.name ?? m.id }))
                    .sort((a, b) => a.id.localeCompare(b.id));
            }

            if (models.length > 0) cache.set(models);
            return models;
        } catch (err) {
            log.warn(`Failed to fetch models for provider ${providerId}:`, err);
            return cache.getStale() ?? [];
        }
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
        const modelId = settings.activeModel ?? resolveDefaultModel(settings, providerId);
        if (!providerId || !modelId) {
            throw new Error('Aucun fournisseur IA ou modèle actif n\u2019a été configuré.');
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
        const installedLanguages = await languagePackService.getInstalledLanguages();
        const isLocal = providerId === 'local';
        const { recentMessages, summary } = buildConversationContext(
            conversation.id,
            settings.maxContextMessages,
            isLocal,
        );
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

        const runner = this.getRunner(providerId);

        log.info('AI generation starting', {
            providerId,
            modelId,
            conversationId: conversation.id,
        });

        void (async () => {
            try {
                await runner.run({
                    browserWindow,
                    conversationId: conversation.id,
                    assistantMessageId: assistantMessage.id,
                    model,
                    systemPrompt,
                    history: recentMessages,
                    tools,
                    abortSignal: controller.signal,
                });

                const nextContext = buildConversationContext(
                    conversation.id,
                    settings.maxContextMessages,
                );
                aiRepo.updateConversation(conversation.id, {
                    summary: nextContext.summary,
                    languageCode: activeLanguageCode,
                });
                sendToRenderer(browserWindow, PushChannels.aiStreamComplete, {
                    conversationId: conversation.id,
                    messageId: assistantMessage.id,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : 'AI generation failed.';
                log.error('AI generation failed', {
                    conversationId: conversation.id,
                    providerId,
                    modelId,
                    message,
                });
                sendToRenderer(browserWindow, PushChannels.aiStreamError, {
                    conversationId: conversation.id,
                    messageId: assistantMessage.id,
                    error: message,
                });
            } finally {
                this.controllers.delete(conversation.id);
            }
        })();

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

    private getRunner(providerId: string): GenerationRunnerImpl {
        return new GenerationRunnerImpl(providerId === 'local');
    }
}
