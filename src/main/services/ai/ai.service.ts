import { generateText, stepCountIs, streamText, type LanguageModel } from 'ai';
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
    AiToolCall,
    AiToolResult,
} from '@shared/ai.types';
import { buildSystemPrompt } from './system-prompt';
import { scanLocalModels } from './local/local-model.service';
import { LocalRuntimeService } from './local/local-runtime.service';
import { buildAiTools } from './tools';
import { sendToRenderer } from '@main/ipc/register';
import { buildConversationContext } from './context-memory';
import { resolveDefaultModel, resolveLanguageModel } from './provider-resolver';
import { getAiProviderCatalog } from './provider-catalog';

export class AiService {
    private controllers = new Map<string, AbortController>();
    private localRuntime = new LocalRuntimeService();

    getSettings(): AiSettings {
        return aiRepo.ensureSettings();
    }

    getProviderCatalog() {
        return getAiProviderCatalog();
    }

    updateSettings(partial: Partial<AiSettings>): AiSettings {
        const settings = aiRepo.updateSettings(partial);
        aiRepo.trimConversationHistory(settings.maxHistoryConversations);
        return settings;
    }

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

    async scanLocalModels() {
        return scanLocalModels();
    }

    stopGeneration(conversationId: string): void {
        this.controllers.get(conversationId)?.abort();
        this.controllers.delete(conversationId);
    }

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
                maxOutputTokens: 5,
            });
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Provider validation failed.',
            };
        }
    }

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
            throw new Error('Aucun fournisseur IA ou modèle actif n’a été configuré.');
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
        const { recentMessages, summary } = buildConversationContext(
            conversation.id,
            settings.maxContextMessages,
        );
        const system = buildSystemPrompt({
            activeLanguageCode,
            overrideLanguageCode: request.overrideLanguageCode,
            installedLanguages,
            languagePreference: settings.languagePreference,
        });
        const systemPrompt = summary ? `${system}\n\nConversation memory:\n${summary}` : system;
        const tools = buildAiTools(activeLanguageCode);
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

        log.info('AI generation starting', {
            providerId,
            modelId,
            conversationId: conversation.id,
        });

        void (async () => {
            try {
                await this.runGeneration({
                    browserWindow,
                    conversationId: conversation.id,
                    assistantMessageId: assistantMessage.id,
                    model,
                    systemPrompt,
                    history: recentMessages,
                    tools,
                    controller,
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

    dispose(): void {
        for (const conversationId of this.controllers.keys()) {
            this.stopGeneration(conversationId);
        }
        void this.localRuntime.dispose();
    }

    private async runGeneration(input: {
        browserWindow: BrowserWindow;
        conversationId: string;
        assistantMessageId: string;
        model: LanguageModel;
        systemPrompt: string;
        history: Array<{ role: 'user' | 'assistant'; content: string }>;
        tools: ReturnType<typeof buildAiTools>;
        controller: AbortController;
    }): Promise<void> {
        const result = streamText({
            model: input.model,
            system: input.systemPrompt,
            messages: input.history,
            tools: input.tools,
            stopWhen: stepCountIs(6),
            abortSignal: input.controller.signal,
        });

        for await (const part of result.fullStream) {
            switch (part.type) {
                case 'text-delta':
                    this.handleTextDelta(
                        input.browserWindow,
                        input.conversationId,
                        input.assistantMessageId,
                        part.text,
                    );
                    break;
                case 'tool-call':
                    this.handleToolCall(
                        input.browserWindow,
                        input.conversationId,
                        input.assistantMessageId,
                        {
                            id: part.toolCallId,
                            name: part.toolName,
                            input: (part.input as Record<string, unknown>) ?? {},
                        },
                    );
                    break;
                case 'tool-result':
                    this.handleToolResult(
                        input.browserWindow,
                        input.conversationId,
                        input.assistantMessageId,
                        {
                            toolCallId: part.toolCallId,
                            name: part.toolName,
                            output: part.output,
                        },
                    );
                    break;
                case 'error':
                    throw new Error(
                        typeof part.error === 'string'
                            ? part.error
                            : part.error instanceof Error
                              ? part.error.message
                              : 'AI stream failed.',
                    );
                default:
                    break;
            }
        }
    }

    private handleTextDelta(
        browserWindow: BrowserWindow,
        conversationId: string,
        assistantMessageId: string,
        delta: string,
    ): void {
        aiRepo.appendAssistantContent(assistantMessageId, delta);
        sendToRenderer(browserWindow, PushChannels.aiStreamChunk, {
            conversationId,
            messageId: assistantMessageId,
            delta,
        });
    }

    private handleToolCall(
        browserWindow: BrowserWindow,
        conversationId: string,
        assistantMessageId: string,
        toolCall: AiToolCall,
    ): void {
        aiRepo.setAssistantToolCalls(assistantMessageId, [
            ...aiRepo.getMessage(assistantMessageId)!.toolCalls,
            toolCall,
        ]);
        sendToRenderer(browserWindow, PushChannels.aiToolCallStart, {
            conversationId,
            messageId: assistantMessageId,
            toolName: toolCall.name,
            toolCallId: toolCall.id,
            payload: toolCall.input,
        });
    }

    private handleToolResult(
        browserWindow: BrowserWindow,
        conversationId: string,
        assistantMessageId: string,
        toolResult: AiToolResult,
    ): void {
        aiRepo.addAssistantToolResult(assistantMessageId, toolResult);
        sendToRenderer(browserWindow, PushChannels.aiToolCallComplete, {
            conversationId,
            messageId: assistantMessageId,
            toolName: toolResult.name,
            toolCallId: toolResult.toolCallId,
            payload: toolResult.output,
        });
    }
}
