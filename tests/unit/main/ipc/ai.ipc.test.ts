import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiChannels } from '@shared/ipc.types';

const registerHandlerMock = vi.fn();
const browserWindow = { id: 1 };
const service = {
    updateSettings: vi.fn((partial: unknown) => partial),
    getConversationsPage: vi.fn(),
    createConversation: vi.fn(),
    renameConversation: vi.fn(),
    deleteConversation: vi.fn(),
    exportConversationPdf: vi.fn(),
    getMessagesPage: vi.fn(),
    sendMessage: vi.fn(),
    retryMessage: vi.fn(),
    stopGeneration: vi.fn(),
    testProvider: vi.fn(),
    fetchProviderModels: vi.fn(),
    resolveModelLimits: vi.fn(),
};

vi.mock('@main/ipc/ipc-bridge', () => ({ registerHandler: registerHandlerMock }));
vi.mock('@main/services/ai', () => ({ getAiService: () => service }));
vi.mock('electron', () => ({
    BrowserWindow: { fromWebContents: vi.fn(() => browserWindow) },
}));

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>;

const { registerAiHandlers } = await import('@main/ipc/ai.ipc');
registerAiHandlers();
const handlers = new Map<string, Handler>(
    registerHandlerMock.mock.calls.map(([channel, handler]) => [channel, handler]),
);

function handlerFor(channel: string): Handler {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler;
}

const event = { sender: {} };

beforeEach(() => {
    for (const fn of Object.values(service)) fn.mockClear();
});

describe('AI IPC input validation', () => {
    it.each([
        [AiChannels.updateSettings, [{ maxHistoryConversations: 0 }], 'updateSettings'],
        [AiChannels.updateSettings, [{ maxHistoryConversations: -1 }], 'updateSettings'],
        [AiChannels.updateSettings, [{ maxHistoryConversations: Number.NaN }], 'updateSettings'],
        [AiChannels.updateSettings, [{ maxHistoryConversations: 1e9 }], 'updateSettings'],
        [AiChannels.updateSettings, [{ enabled: 'true' }], 'updateSettings'],
        [AiChannels.updateSettings, [null], 'updateSettings'],
        [AiChannels.getConversationsPage, [{ limit: -1 }], 'getConversationsPage'],
        [AiChannels.createConversation, [{ title: 3 }], 'createConversation'],
        [AiChannels.renameConversation, ['', 'title'], 'renameConversation'],
        [AiChannels.renameConversation, ['c1', 42], 'renameConversation'],
        [AiChannels.deleteConversation, [undefined], 'deleteConversation'],
        [AiChannels.exportConversationPdf, [{}], 'exportConversationPdf'],
        [AiChannels.getMessagesPage, [{}], 'getMessagesPage'],
        [
            AiChannels.sendMessage,
            [{ conversationId: 'c', messages: 'hi', generationId: 'g' }],
            'sendMessage',
        ],
        [
            AiChannels.sendMessage,
            [{ conversationId: 'c', messages: [], generationId: 'g' }],
            'sendMessage',
        ],
        [AiChannels.retryMessage, [{ conversationId: 'c' }], 'retryMessage'],
        [AiChannels.stopGeneration, [123], 'stopGeneration'],
        [AiChannels.testProvider, [{ providerId: 'openai' }], 'testProvider'],
        [AiChannels.fetchProviderModels, [{ providerId: 5 }], 'fetchProviderModels'],
        [AiChannels.getModelLimits, [{ model: 'm' }], 'resolveModelLimits'],
    ] as const)('%s rejects %j and calls nothing', async (channel, args, method) => {
        await expect(handlerFor(channel)(event, ...args)).rejects.toThrow(/^Invalid /);
        expect(service[method]).not.toHaveBeenCalled();
    });

    it('rejects an oversized message with the translatable error', async () => {
        const request = { conversationId: 'c', messages: ['a'.repeat(100_001)], generationId: 'g' };
        await expect(handlerFor(AiChannels.sendMessage)(event, request)).rejects.toThrow(
            'Le message est trop long. Raccourcissez-le puis réessayez.',
        );
        expect(service.sendMessage).not.toHaveBeenCalled();
    });

    it('passes valid input on to the service', async () => {
        const request = { conversationId: 'c', messages: ["l'amour"], generationId: 'g' };
        await handlerFor(AiChannels.sendMessage)(event, request);
        expect(service.sendMessage).toHaveBeenCalledWith(browserWindow, request);

        await handlerFor(AiChannels.updateSettings)(event, { maxHistoryConversations: 100 });
        expect(service.updateSettings).toHaveBeenCalledWith({ maxHistoryConversations: 100 });

        await handlerFor(AiChannels.renameConversation)(event, 'c', 'Saint-Esprit');
        expect(service.renameConversation).toHaveBeenCalledWith('c', 'Saint-Esprit');

        await handlerFor(AiChannels.createConversation)(event, undefined);
        expect(service.createConversation).toHaveBeenCalledWith(undefined);

        await handlerFor(AiChannels.stopGeneration)(event, 'c');
        expect(service.stopGeneration).toHaveBeenCalledWith('c');
    });
});
