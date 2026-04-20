import { BrowserWindow } from 'electron';
import { AiChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import { getAiService } from '@main/services/ai';

export function registerAiHandlers(): void {
    registerHandler(AiChannels.getSettings, async () => getAiService().getSettings());
    registerHandler(AiChannels.getProviderCatalog, async () => getAiService().getProviderCatalog());

    registerHandler(AiChannels.updateSettings, async (_event, partial) =>
        getAiService().updateSettings(partial),
    );

    registerHandler(AiChannels.getConversationsPage, async (_event, request) =>
        getAiService().getConversationsPage(request),
    );

    registerHandler(AiChannels.createConversation, async (_event, input) =>
        getAiService().createConversation(input),
    );

    registerHandler(AiChannels.renameConversation, async (_event, conversationId, title) =>
        getAiService().renameConversation(conversationId, title),
    );

    registerHandler(AiChannels.deleteConversation, async (_event, conversationId) => {
        getAiService().deleteConversation(conversationId);
    });

    registerHandler(AiChannels.exportConversationPdf, async (event, conversationId) => {
        const browserWindow = BrowserWindow.fromWebContents(event.sender);
        if (!browserWindow) {
            throw new Error('Main window not available for PDF export.');
        }
        return getAiService().exportConversationPdf(browserWindow, conversationId);
    });

    registerHandler(AiChannels.clearConversations, async () => {
        getAiService().clearConversations();
    });

    registerHandler(AiChannels.getMessagesPage, async (_event, request) =>
        getAiService().getMessagesPage(request),
    );

    registerHandler(AiChannels.sendMessage, async (event, request) => {
        const browserWindow = BrowserWindow.fromWebContents(event.sender);
        if (!browserWindow) {
            throw new Error('Main window not available for AI streaming.');
        }
        return getAiService().sendMessage(browserWindow, request);
    });

    registerHandler(AiChannels.retryMessage, async (event, request) => {
        const browserWindow = BrowserWindow.fromWebContents(event.sender);
        if (!browserWindow) {
            throw new Error('Main window not available for AI streaming.');
        }
        return getAiService().retryMessage(browserWindow, request);
    });

    registerHandler(AiChannels.stopGeneration, async (_event, conversationId) => {
        getAiService().stopGeneration(conversationId);
    });

    registerHandler(AiChannels.scanLocalModels, async () => getAiService().scanLocalModels());

    registerHandler(AiChannels.testProvider, async (_event, input) =>
        getAiService().testProvider(input),
    );

    registerHandler(AiChannels.fetchProviderModels, async (_event, input) =>
        getAiService().fetchProviderModels(input),
    );

    registerHandler(AiChannels.downloadModel, async (event, modelId) => {
        const browserWindow = BrowserWindow.fromWebContents(event.sender);
        if (!browserWindow) {
            throw new Error('Main window not available for model download.');
        }
        return getAiService().downloadModel(browserWindow, modelId);
    });
}
