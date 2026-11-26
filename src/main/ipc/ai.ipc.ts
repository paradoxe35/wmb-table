import { BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { AiChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import { getAiService } from '@main/services/ai';
import {
    conversationIdSchema,
    conversationsPageRequestSchema,
    conversationTitleSchema,
    createConversationInputSchema,
    messagesPageRequestSchema,
    modelLimitsInputSchema,
    parseAiInput,
    providerModelsInputSchema,
    providerTestInputSchema,
    retryMessageRequestSchema,
    sendMessageRequestSchema,
    settingsPatchSchema,
} from './ai.schemas';

function requireSenderWindow(event: IpcMainInvokeEvent, purpose: string): BrowserWindow {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow) {
        throw new Error(`Main window not available for ${purpose}.`);
    }
    return browserWindow;
}

export function registerAiHandlers(): void {
    registerHandler(AiChannels.getSettings, async () => getAiService().getSettings());
    registerHandler(AiChannels.getProviderCatalog, async () => getAiService().getProviderCatalog());

    registerHandler(AiChannels.updateSettings, async (_event, partial) =>
        getAiService().updateSettings(parseAiInput(settingsPatchSchema, partial, 'AI settings')),
    );

    registerHandler(AiChannels.getConversationsPage, async (_event, request) =>
        getAiService().getConversationsPage(
            parseAiInput(conversationsPageRequestSchema, request, 'conversation page request'),
        ),
    );

    registerHandler(AiChannels.createConversation, async (_event, input) =>
        getAiService().createConversation(
            parseAiInput(createConversationInputSchema, input, 'conversation'),
        ),
    );

    registerHandler(AiChannels.renameConversation, async (_event, conversationId, title) =>
        getAiService().renameConversation(
            parseAiInput(conversationIdSchema, conversationId, 'conversation id'),
            parseAiInput(conversationTitleSchema, title, 'conversation title'),
        ),
    );

    registerHandler(AiChannels.deleteConversation, async (_event, conversationId) => {
        getAiService().deleteConversation(
            parseAiInput(conversationIdSchema, conversationId, 'conversation id'),
        );
    });

    registerHandler(AiChannels.exportConversationPdf, async (event, conversationId) => {
        const id = parseAiInput(conversationIdSchema, conversationId, 'conversation id');
        return getAiService().exportConversationPdf(requireSenderWindow(event, 'PDF export'), id);
    });

    registerHandler(AiChannels.clearConversations, async () => {
        getAiService().clearConversations();
    });

    registerHandler(AiChannels.getMessagesPage, async (_event, request) =>
        getAiService().getMessagesPage(
            parseAiInput(messagesPageRequestSchema, request, 'message page request'),
        ),
    );

    registerHandler(AiChannels.sendMessage, async (event, request) => {
        const input = parseAiInput(sendMessageRequestSchema, request, 'message request');
        return getAiService().sendMessage(requireSenderWindow(event, 'AI streaming'), input);
    });

    registerHandler(AiChannels.retryMessage, async (event, request) => {
        const input = parseAiInput(retryMessageRequestSchema, request, 'retry request');
        return getAiService().retryMessage(requireSenderWindow(event, 'AI streaming'), input);
    });

    registerHandler(AiChannels.stopGeneration, async (_event, conversationId) => {
        getAiService().stopGeneration(
            parseAiInput(conversationIdSchema, conversationId, 'conversation id'),
        );
    });

    registerHandler(AiChannels.testProvider, async (_event, input) =>
        getAiService().testProvider(parseAiInput(providerTestInputSchema, input, 'provider test')),
    );

    registerHandler(AiChannels.fetchProviderModels, async (_event, input) =>
        getAiService().fetchProviderModels(
            parseAiInput(providerModelsInputSchema, input, 'model list request'),
        ),
    );

    registerHandler(AiChannels.getModelLimits, async (_event, input) =>
        getAiService().resolveModelLimits(
            parseAiInput(modelLimitsInputSchema, input, 'model limits request'),
        ),
    );
}
