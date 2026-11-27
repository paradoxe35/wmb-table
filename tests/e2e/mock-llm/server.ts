import { appendFileSync, mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    contentText,
    encodeCompletionJson,
    encodeStreamFrames,
    pickScenario,
    readScenarioContext,
    readToolChoice,
    type WireFrame,
} from './openai-wire';
import {
    MOCK_CONTEXT_WINDOW,
    MOCK_MAX_COMPLETION_TOKENS,
    MOCK_MODEL_ID,
    type ChatRequest,
    type Reply,
    type Scenario,
} from './scenario';
import { DEFAULT_SCENARIO, scenarios as defaultScenarios } from './scenarios';

export interface RecordedRequest {
    at: string;
    path: string;
    scenario: string;
    tag: string | null;
    stepIndex: number;
    stream: boolean;
    model: string;
    maxTokens: number | null;
    reasoningEffort: string | null;
    toolChoice: string | null;
    messageCount: number;
    /** All message text, tool call arguments included: a rough size of the prompt. */
    promptChars: number;
    condensedToolResults: number;
    lastToolResultChars: number;
    roles: string[];
    toolNames: string[];
    toolResultCount: number;
    toolResultChars: number;
    systemChars: number;
    lastUserText: string;
    status: number;
    outcome: 'completed' | 'http-error' | 'dropped' | 'client-closed';
}

export interface MockLlmServer {
    port: number;
    baseUrl: string;
    requests: RecordedRequest[];
    close(): Promise<void>;
}

export interface MockLlmServerOptions {
    port?: number;
    logFile?: string;
    scenarios?: Scenario[];
}

const MODELS_BODY = {
    object: 'list',
    data: [
        {
            id: MOCK_MODEL_ID,
            name: 'Mock Model',
            object: 'model',
            owned_by: 'wmb-table-tests',
            context_length: MOCK_CONTEXT_WINDOW,
            top_provider: {
                context_length: MOCK_CONTEXT_WINDOW,
                max_completion_tokens: MOCK_MAX_COMPLETION_TOKENS,
            },
        },
    ],
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString('utf8');
}

function waitUnlessClosed(ms: number, res: ServerResponse): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(done, ms);
        res.once('close', done);
        function done() {
            clearTimeout(timer);
            res.off('close', done);
            resolve();
        }
    });
}

async function writeSse(
    res: ServerResponse,
    frames: WireFrame[],
    chunkDelayMs: number,
): Promise<RecordedRequest['outcome']> {
    res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
    });
    res.flushHeaders();
    for (const frame of frames) {
        if (res.destroyed) return 'client-closed';
        if (frame.type === 'pause') {
            await waitUnlessClosed(frame.ms, res);
            continue;
        }
        if (frame.type === 'drop') {
            res.socket?.destroy();
            return 'dropped';
        }
        res.write(`data: ${JSON.stringify(frame.json)}\n\n`);
        if (chunkDelayMs > 0) await waitUnlessClosed(chunkDelayMs, res);
    }
    if (res.destroyed) return 'client-closed';
    res.end('data: [DONE]\n\n');
    return 'completed';
}

async function writeReply(
    res: ServerResponse,
    reply: Reply,
    request: ChatRequest,
): Promise<RecordedRequest['outcome']> {
    if (reply.kind === 'http-error') {
        sendJson(res, reply.status, { error: reply.error });
        return 'http-error';
    }
    if (request.stream) {
        return writeSse(res, encodeStreamFrames(reply, request.model), reply.chunkDelayMs ?? 0);
    }
    const encoded = encodeCompletionJson(reply, request.model);
    await waitUnlessClosed(encoded.pauseMs, res);
    if (encoded.drops) {
        res.socket?.destroy();
        return 'dropped';
    }
    sendJson(res, 200, encoded.body);
    return 'completed';
}

function summarizeRequest(path: string, request: ChatRequest, scenario: Scenario) {
    const ctx = readScenarioContext(request);
    const messages = request.messages ?? [];
    const toolMessages = messages.filter((message) => message.role === 'tool');
    return {
        at: new Date().toISOString(),
        path,
        scenario: scenario.name,
        tag: ctx.tag,
        stepIndex: ctx.stepIndex,
        stream: Boolean(request.stream),
        model: request.model,
        maxTokens: request.max_tokens ?? null,
        reasoningEffort: request.reasoning_effort ?? null,
        toolChoice: readToolChoice(request),
        messageCount: messages.length,
        promptChars: messages.reduce(
            (sum, m) =>
                sum +
                contentText(m.content).length +
                (m.tool_calls ?? []).reduce((n, call) => n + call.function.arguments.length, 0),
            0,
        ),
        condensedToolResults: toolMessages.filter((m) =>
            contentText(m.content).startsWith('[Condensed earlier result]'),
        ).length,
        lastToolResultChars: contentText(toolMessages[toolMessages.length - 1]?.content).length,
        roles: messages.map((message) => message.role),
        toolNames: (request.tools ?? []).map((tool) => tool.function.name),
        toolResultCount: toolMessages.length,
        toolResultChars: toolMessages.reduce((sum, m) => sum + contentText(m.content).length, 0),
        systemChars: messages
            .filter((message) => message.role === 'system')
            .reduce((sum, m) => sum + contentText(m.content).length, 0),
        lastUserText: ctx.userText.slice(0, 300),
    };
}

export async function startMockLlmServer(
    options: MockLlmServerOptions = {},
): Promise<MockLlmServer> {
    const scenarioList = options.scenarios ?? defaultScenarios;
    const requests: RecordedRequest[] = [];
    if (options.logFile) mkdirSync(dirname(options.logFile), { recursive: true });

    const record = (entry: RecordedRequest) => {
        requests.push(entry);
        if (options.logFile) appendFileSync(options.logFile, `${JSON.stringify(entry)}\n`);
    };

    const handleChat = async (req: IncomingMessage, res: ServerResponse) => {
        const request = JSON.parse(await readBody(req)) as ChatRequest;
        const ctx = readScenarioContext(request);
        const scenario = pickScenario(ctx, scenarioList, DEFAULT_SCENARIO);
        const summary = summarizeRequest(req.url ?? '', request, scenario);
        const reply = scenario.reply(ctx);
        const status = reply.kind === 'http-error' ? reply.status : 200;
        const outcome = await writeReply(res, reply, request);
        record({ ...summary, status, outcome });
    };

    const server = createServer((req, res) => {
        const path = (req.url ?? '').split('?')[0];
        if (req.method === 'GET' && path === '/v1/models') return sendJson(res, 200, MODELS_BODY);
        if (req.method === 'POST' && path === '/v1/chat/completions') {
            handleChat(req, res).catch((error: unknown) => {
                if (!res.headersSent) sendJson(res, 400, { error: { message: String(error) } });
            });
            return;
        }
        sendJson(res, 404, { error: { message: `No mock route for ${req.method} ${path}` } });
    });

    await new Promise<void>((resolve) => server.listen(options.port ?? 0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return {
        port,
        baseUrl: `http://127.0.0.1:${port}/v1`,
        requests,
        close: () =>
            new Promise((resolve) => {
                server.closeAllConnections();
                server.close(() => resolve());
            }),
    };
}

function readFlag(name: string): string | undefined {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
    const server = await startMockLlmServer({
        port: Number(readFlag('port') ?? 0),
        logFile: readFlag('log'),
    });
    console.log(`Mock LLM server: ${server.baseUrl} (model "${MOCK_MODEL_ID}")`);
    console.log(`Scenarios: ${defaultScenarios.map((scenario) => scenario.name).join(', ')}`);
    process.on('SIGINT', () => void server.close().then(() => process.exit(0)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    void runCli();
}
