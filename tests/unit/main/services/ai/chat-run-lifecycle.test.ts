import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { createDefaultAiSettings } from '@shared/ai.types';
import { createTestDb } from '../../database/test-helpers';
import {
    apiError,
    callTool,
    createScriptedModel,
    pause,
    say,
    step,
    type ScriptStep,
} from '../../../../helpers/mock-model';

interface PushedEvent {
    channel: string;
    payload: Record<string, unknown>;
    syncedMessageIds: string[];
}

const pushed: PushedEvent[] = [];
const resolveEnvironmentMock = vi.fn();
const buildToolsMock = vi.fn((): ToolSet => ({}));
const generateTitleMock = vi.fn(async (): Promise<string | null> => null);

vi.mock('@main/ipc/ipc-bridge', () => ({
    sendToRenderer: (_window: unknown, channel: string, payload: Record<string, unknown>) => {
        pushed.push({ channel, payload, syncedMessageIds: syncedAssistantIds() });
    },
}));

vi.mock('@main/services/ai/generation-environment', () => ({
    resolveGenerationEnvironment: resolveEnvironmentMock,
}));

vi.mock('@main/services/ai/tools', () => ({
    buildAiTools: buildToolsMock,
}));

vi.mock('@main/services/ai/title-generator', () => ({
    shouldGenerateTitle: (count: number, aiTitle: boolean) => count >= 2 && !aiTitle,
    generateConversationTitle: generateTitleMock,
}));

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const aiRepo = await import('@main/database/repositories/ai.repository');
const { getAllChangeLogs } = await import('@main/services/sync/change-log.service');
const { resolveChatTimeouts } = await import('@main/services/ai/model-timeouts');
const { AiService } = await import('@main/services/ai/ai.service');

function syncedAssistantIds(): string[] {
    try {
        return getAllChangeLogs()
            .filter((change) => change.tableName === 'ai_messages' && change.operation === 'SAVE')
            .map((change) => change.rowId);
    } catch {
        return [];
    }
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

function environmentFor(steps: ScriptStep[]) {
    const scripted = createScriptedModel(steps);
    const environment = {
        settings: createDefaultAiSettings(),
        providerId: 'openai',
        modelId: 'mock-model',
        contentLanguageCode: 'fr',
        uiLanguageCode: 'fr',
        activeBibleVersion: undefined,
        modelLimits: { contextWindow: 128_000, maxOutputTokens: 8_000 },
        model: scripted.model,
        installedLanguages: [],
        timeouts: resolveChatTimeouts(false),
        reasoningControl: true,
    };
    return { scripted, environment };
}

function scriptModel(steps: ScriptStep[]) {
    const { scripted, environment } = environmentFor(steps);
    resolveEnvironmentMock.mockResolvedValue(environment);
    return scripted;
}

const mainWindow = { isDestroyed: () => false, name: 'main' };
const otherWindow = { isDestroyed: () => false, name: 'other' };

function eventsFor(generationId: string, channel?: string): PushedEvent[] {
    return pushed.filter(
        (event) =>
            event.payload.generationId === generationId &&
            (channel === undefined || event.channel === channel),
    );
}

const END_CHANNELS = ['push:aiStreamComplete', 'push:aiStreamError', 'push:aiStreamCancel'];

async function waitForEnd(generationId: string): Promise<PushedEvent> {
    await vi.waitFor(() => {
        expect(eventsFor(generationId).some((e) => END_CHANNELS.includes(e.channel))).toBe(true);
    });
    return eventsFor(generationId).find((e) => END_CHANNELS.includes(e.channel))!;
}

function settle(ms = 30): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function assistantRows(conversationId: string) {
    return aiRepo.getMessages(conversationId).filter((message) => message.role === 'assistant');
}

describe('chat run lifecycle', () => {
    let conversationId: string;
    let closeDb: () => void;

    beforeEach(() => {
        pushed.length = 0;
        vi.clearAllMocks();
        generateTitleMock.mockResolvedValue(null);
        buildToolsMock.mockReturnValue({});
        const { sqlite, syncSqlite } = createTestDb();
        closeDb = () => {
            sqlite.close();
            syncSqlite.close();
        };
        aiRepo.ensureSettings();
        conversationId = aiRepo.createConversation('fr', 'Test').id;
    });

    afterEach(async () => {
        await settle();
    });

    function send(
        service: InstanceType<typeof AiService>,
        generationId: string,
        window = mainWindow,
    ) {
        return service.sendMessage(window as never, {
            conversationId,
            messages: ['Bonjour'],
            generationId,
        });
    }

    describe('stop while the run is starting', () => {
        it('cancels before any model call and keeps only the user message', async () => {
            const scripted = environmentFor([step([say('Should never stream')])]);
            const environment = deferred<typeof scripted.environment>();
            resolveEnvironmentMock.mockReturnValue(environment.promise);
            const service = new AiService();

            const sending = send(service, 'gen-1');
            service.stopGeneration(conversationId);
            environment.resolve(scripted.environment);
            await sending;
            await settle();

            expect(scripted.scripted.calls).toHaveLength(0);
            expect(eventsFor('gen-1', 'push:aiStreamCancel')).toHaveLength(1);
            expect(eventsFor('gen-1', 'push:aiStreamChunk')).toHaveLength(0);
            const messages = aiRepo.getMessages(conversationId);
            expect(messages.map((message) => message.role)).toEqual(['user']);
            expect(messages[0].content).toBe('Bonjour');
        });

        it('does not wait for a slow environment once stopped', async () => {
            resolveEnvironmentMock.mockReturnValue(new Promise(() => {}));
            const service = new AiService();

            const sending = send(service, 'gen-1');
            service.stopGeneration(conversationId);

            await expect(sending).resolves.toMatchObject({ generationId: 'gen-1' });
            expect(assistantRows(conversationId)).toHaveLength(0);
        });

        it('also cancels a retry that is still starting', async () => {
            aiRepo.createMessage({ conversationId, role: 'user', content: 'Question' });
            const userMessage = aiRepo.getMessages(conversationId)[0];
            const scripted = environmentFor([step([say('Should never stream')])]);
            resolveEnvironmentMock.mockReturnValue(new Promise(() => {}));
            const service = new AiService();

            const retrying = service.retryMessage(mainWindow as never, {
                conversationId,
                lastUserMessageId: userMessage.id,
                generationId: 'gen-retry',
            });
            service.stopGeneration(conversationId);
            await retrying;

            expect(scripted.scripted.calls).toHaveLength(0);
            expect(eventsFor('gen-retry', 'push:aiStreamCancel')).toHaveLength(1);
            expect(assistantRows(conversationId)).toHaveLength(0);
        });
    });

    it('keeps the tool call and stops cleanly when stopped while a tool runs', async () => {
        const toolStarted = deferred<void>();
        buildToolsMock.mockReturnValue({
            slowTool: tool({
                description: 'slow',
                inputSchema: z.object({}),
                execute: async () => {
                    toolStarted.resolve();
                    await new Promise(() => {});
                    return 'never';
                },
            }),
        });
        scriptModel([step([callTool('slowTool', {})]), step([say('After tool')])]);
        const service = new AiService();

        const { assistantMessage } = await send(service, 'gen-1');
        await toolStarted.promise;
        await vi.waitFor(() => {
            expect(eventsFor('gen-1', 'push:aiToolCallStart')).toHaveLength(1);
        });
        service.stopGeneration(conversationId);
        await settle();

        expect(eventsFor('gen-1', 'push:aiStreamCancel')).toHaveLength(1);
        expect(eventsFor('gen-1', 'push:aiToolCallComplete')).toHaveLength(0);
        const saved = aiRepo.getMessage(assistantMessage.id);
        expect(saved?.toolCalls.map((call) => call.name)).toEqual(['slowTool']);
        expect(syncedAssistantIds()).toContain(assistantMessage.id);
    });

    it('keeps and syncs the partial answer when stopped while text streams', async () => {
        scriptModel([step([say('Une réponse partielle'), pause(5_000), say('jamais')])]);
        const service = new AiService();

        const { assistantMessage } = await send(service, 'gen-1');
        await vi.waitFor(() => {
            expect(eventsFor('gen-1', 'push:aiStreamChunk').length).toBeGreaterThan(0);
        });
        service.stopGeneration(conversationId);
        await settle(100);

        const cancel = eventsFor('gen-1', 'push:aiStreamCancel');
        expect(cancel).toHaveLength(1);
        expect(cancel[0].syncedMessageIds).toContain(assistantMessage.id);
        expect(aiRepo.getMessage(assistantMessage.id)?.content).toContain('partielle');
        const lastEvent = eventsFor('gen-1').at(-1);
        expect(lastEvent?.channel).toBe('push:aiStreamCancel');
    });

    it('sends a single cancel for a double stop and none after the answer completed', async () => {
        scriptModel([step([say('Fini.')])]);
        const service = new AiService();

        await send(service, 'gen-1');
        await waitForEnd('gen-1');
        service.stopGeneration(conversationId);
        expect(eventsFor('gen-1', 'push:aiStreamCancel')).toHaveLength(0);

        scriptModel([step([say('Long'), pause(5_000)])]);
        await send(service, 'gen-2');
        service.stopGeneration(conversationId);
        service.stopGeneration(conversationId);
        expect(eventsFor('gen-2', 'push:aiStreamCancel')).toHaveLength(1);
    });

    it('removes the empty reply of a run stopped before any text', async () => {
        scriptModel([step([pause(5_000), say('late')])]);
        const service = new AiService();

        await send(service, 'gen-1');
        service.stopGeneration(conversationId);
        await settle();

        expect(assistantRows(conversationId)).toHaveLength(0);
        expect(aiRepo.getMessages(conversationId)).toHaveLength(1);
    });

    it('saves the partial answer at quit, so the database can close right after', async () => {
        scriptModel([step([say('Réponse avant la fermeture'), pause(5_000), say('jamais')])]);
        const service = new AiService();

        const { assistantMessage } = await send(service, 'gen-1');
        await vi.waitFor(() => {
            expect(eventsFor('gen-1', 'push:aiStreamChunk').length).toBeGreaterThan(0);
        });
        service.dispose();
        const saved = aiRepo.getMessage(assistantMessage.id);
        const synced = syncedAssistantIds();
        closeDb();
        await settle(100);

        expect(saved?.content).toContain('fermeture');
        expect(synced).toContain(assistantMessage.id);
    });

    it('stops the runs of a closed window and leaves other windows alone', async () => {
        scriptModel([step([say('Fenêtre A'), pause(5_000)])]);
        const service = new AiService();
        await send(service, 'gen-a');

        const otherConversation = aiRepo.createConversation('fr', 'Other').id;
        scriptModel([step([say('Fenêtre B'), pause(5_000)])]);
        await service.sendMessage(otherWindow as never, {
            conversationId: otherConversation,
            messages: ['Salut'],
            generationId: 'gen-b',
        });

        service.stopGenerationsForWindow(mainWindow as never);

        expect(eventsFor('gen-a', 'push:aiStreamCancel')).toHaveLength(1);
        expect(eventsFor('gen-b', 'push:aiStreamCancel')).toHaveLength(0);
        service.dispose();
    });

    it('records the reply for sync before announcing that it is complete', async () => {
        scriptModel([step([say('Réponse complète.')])]);
        const service = new AiService();

        const { assistantMessage } = await send(service, 'gen-1');
        const complete = await waitForEnd('gen-1');

        expect(complete.channel).toBe('push:aiStreamComplete');
        expect(complete.syncedMessageIds).toContain(assistantMessage.id);
    });

    it('announces the answer while the title is still generating, and ignores a title failure', async () => {
        aiRepo.createMessage({ conversationId, role: 'user', content: 'Avant' });
        aiRepo.createMessage({ conversationId, role: 'assistant', content: 'Réponse' });
        generateTitleMock.mockReturnValue(new Promise(() => {}));
        scriptModel([step([say('Réponse.')])]);
        const service = new AiService();

        await send(service, 'gen-1');
        const end = await waitForEnd('gen-1');

        expect(end.channel).toBe('push:aiStreamComplete');
        expect(generateTitleMock).toHaveBeenCalledTimes(1);

        generateTitleMock.mockRejectedValue(new Error('title model down'));
        scriptModel([step([say('Encore.')])]);
        await send(service, 'gen-2');
        expect((await waitForEnd('gen-2')).channel).toBe('push:aiStreamComplete');
        service.dispose();
    });

    it('stops asking for a title after a failed retry', async () => {
        aiRepo.createMessage({ conversationId, role: 'user', content: 'Avant' });
        aiRepo.createMessage({ conversationId, role: 'assistant', content: 'Réponse' });
        generateTitleMock.mockResolvedValue(null);
        const service = new AiService();

        for (const generationId of ['gen-1', 'gen-2', 'gen-3']) {
            scriptModel([step([say('Réponse.')])]);
            await send(service, generationId);
            await waitForEnd(generationId);
            await settle();
        }

        expect(generateTitleMock).toHaveBeenCalledTimes(2);
        expect(aiRepo.getConversation(conversationId)?.title).toBe('Test');
    });

    it('does not crash when the reply row is deleted while text streams', async () => {
        scriptModel([step([say('Un'), pause(200), say('deux trois'), pause(200), say('quatre')])]);
        const service = new AiService();

        const { assistantMessage } = await send(service, 'gen-1');
        await vi.waitFor(() => {
            expect(eventsFor('gen-1', 'push:aiStreamChunk').length).toBeGreaterThan(0);
        });
        aiRepo.deleteMessage(assistantMessage.id);
        await settle(600);

        expect(aiRepo.getMessage(assistantMessage.id)).toBeNull();
        expect(eventsFor('gen-1').some((e) => END_CHANNELS.includes(e.channel))).toBe(true);
    });

    it('sends an error code and a scrubbed detail when the provider refuses the key', async () => {
        scriptModel([
            step([], {
                reject: apiError(
                    401,
                    'Incorrect API key provided: sk-proj-abcdefghijklmnopqrstuvwxyz123456.',
                ),
            }),
        ]);
        const service = new AiService();

        await send(service, 'gen-1');
        const end = await waitForEnd('gen-1');

        expect(end.channel).toBe('push:aiStreamError');
        expect(end.payload).toMatchObject({ code: 'auth', retryable: false });
        expect(String(end.payload.error)).not.toContain('abcdefghijklmnop');
        expect(aiRepo.getMessages(conversationId).map((m) => m.role)).toEqual(['user']);
    });

    describe('abandoned replies', () => {
        it('removes empty replies left by an earlier crash but not the live one', async () => {
            const stale = aiRepo.createMessage({ conversationId, role: 'assistant', content: '' });
            const kept = aiRepo.createMessage({
                conversationId,
                role: 'assistant',
                content: 'Texte',
            });
            await settle(5);
            scriptModel([step([pause(5_000), say('late')])]);
            const service = new AiService();
            const { assistantMessage } = await send(service, 'gen-1');

            service.removeAbandonedReplies();

            expect(aiRepo.getMessage(stale.id)).toBeNull();
            expect(aiRepo.getMessage(kept.id)).not.toBeNull();
            expect(aiRepo.getMessage(assistantMessage.id)).not.toBeNull();
            service.dispose();
        });
    });
});
