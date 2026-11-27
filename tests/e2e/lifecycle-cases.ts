import { lastAssistantText, type CaseContext, type E2eCase } from './case-runner';

interface PushedError {
    generationId: string;
    error: string;
    code?: string;
    retryable?: boolean;
}

interface StoredMessage {
    role: 'user' | 'assistant';
    content: string;
}

const CAPTURE_ERRORS = `(() => {
    if (!window.__e2eAiErrors) {
        window.__e2eAiErrors = [];
        window.api.on.aiStreamError((event) => window.__e2eAiErrors.push(event));
    }
    return true;
})()`;

async function capturedErrors(ctx: CaseContext): Promise<PushedError[]> {
    return ctx.page.evaluate<PushedError[]>('window.__e2eAiErrors ?? []');
}

async function latestConversationMessages(ctx: CaseContext): Promise<StoredMessage[]> {
    return ctx.page.evaluate<StoredMessage[]>(`(async () => {
        const page = await window.api.ai.getConversationsPage({ limit: 1 });
        const conversation = page.conversations[0];
        if (!conversation) return [];
        const history = await window.api.ai.getMessagesPage({ conversationId: conversation.id, limit: 50 });
        return history.messages.map((m) => ({ role: m.role, content: m.content }));
    })()`);
}

const EXPECTED_CODES: { scenario: string; code: string; retryable: boolean }[] = [
    { scenario: '401', code: 'auth', retryable: false },
    { scenario: '404', code: 'model-not-found', retryable: false },
    { scenario: '500', code: 'provider-unavailable', retryable: true },
    { scenario: 'drop', code: 'network', retryable: true },
];

const errorCodes: E2eCase = {
    name: 'error-codes',
    description: 'Each provider failure reaches the renderer with an error code and retry hint',
    async run(ctx) {
        await ctx.page.evaluate(CAPTURE_ERRORS);
        for (const [index, expected] of EXPECTED_CODES.entries()) {
            const before = (await capturedErrors(ctx)).length;
            if (index > 0) await ctx.page.startNewConversation();
            await ctx.page.send(`Code d'erreur #scenario:${expected.scenario}`);
            await ctx.waitForRunEnd();
            const event = (await capturedErrors(ctx))[before];
            ctx.check(
                `${expected.scenario}: code ${expected.code}, retryable ${expected.retryable}`,
                event?.code === expected.code && event.retryable === expected.retryable,
                event,
            );
            ctx.check(
                `${expected.scenario}: the detail is short and names no URL`,
                Boolean(event?.error) &&
                    event.error.length <= 300 &&
                    !/https?:\/\//.test(event.error),
                event?.error,
            );
        }
        ctx.check(
            'the main log names the code of each failure',
            EXPECTED_CODES.every(({ code }) => ctx.mainLog().includes(`code: '${code}'`)),
        );
    },
};

const stopDuringStartup: E2eCase = {
    name: 'stop-during-startup',
    description: 'Stop sent in the same tick as the message: no answer, no empty reply row',
    async run(ctx) {
        // A used conversation, so the next case's "new conversation" is not this empty one.
        await ctx.page.send('Bonjour');
        await ctx.waitForRunEnd();
        await ctx.page.evaluate(`(async () => {
            const conversation = await window.api.ai.createConversation({});
            const sending = window.api.ai.sendMessage({
                conversationId: conversation.id,
                messages: ['Arrêt immédiat #scenario:slow-first-token #delay=3000'],
                generationId: crypto.randomUUID(),
            });
            const stopping = window.api.ai.stopGeneration(conversation.id);
            await Promise.all([sending, stopping]);
            return true;
        })()`);
        await new Promise((resolve) => setTimeout(resolve, 4_000));
        const stored = await latestConversationMessages(ctx);
        ctx.check(
            'only the user message is stored',
            stored.length === 1 && stored[0].role === 'user',
            stored,
        );
        const requests = ctx.requests().filter((r) => r.scenario === 'slow-first-token');
        ctx.check(
            'no model answer was streamed to the end',
            requests.every((r) => r.outcome !== 'completed'),
            requests.map((r) => r.outcome),
        );
    },
};

const reloadDuringRun: E2eCase = {
    name: 'reload-during-run',
    description: 'Reloading the page mid-answer stops the run and keeps the partial answer',
    async run(ctx) {
        await ctx.page.send('Longue réponse #scenario:slow-stream');
        await ctx.waitUntil((f) => lastAssistantText(f).length > 80, 'streamed text');
        await ctx.page.reload();
        const closed = await ctx.waitForRequest(
            (r) => r.scenario === 'slow-stream' && r.outcome === 'client-closed',
            10_000,
        );
        ctx.check('the model stream was closed', Boolean(closed), ctx.requests());
        const stored = await latestConversationMessages(ctx);
        const answer = stored.filter((m) => m.role === 'assistant').at(-1)?.content ?? '';
        ctx.check(
            'the partial answer is saved, not finished',
            answer.includes('Slow answer') && !answer.includes('MOCK-SLOW-STREAM-DONE'),
            answer.slice(0, 120),
        );
        const final = await ctx.page.facts();
        ctx.check('the reloaded chat shows no running answer', !final.stopButton);
    },
};

export const lifecycleCases: E2eCase[] = [errorCodes, stopDuringStartup, reloadDuringRun];
