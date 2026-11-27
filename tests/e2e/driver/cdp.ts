interface CdpMessage {
    id?: number;
    method?: string;
    params?: Record<string, unknown>;
    result?: Record<string, unknown>;
    error?: { message: string };
}

interface RemoteObject {
    value?: unknown;
    description?: string;
}

interface ExceptionDetails {
    text?: string;
    exception?: RemoteObject;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 100;

export class CdpTimeoutError extends Error {}

/** A Chrome DevTools Protocol session on one page target, over the built-in WebSocket. */
export class CdpSession {
    readonly consoleErrors: string[] = [];
    private nextId = 0;
    private readonly pending = new Map<number, (message: CdpMessage) => void>();
    private readonly listeners = new Map<string, ((params: Record<string, unknown>) => void)[]>();
    private readonly socket: WebSocket;

    private constructor(socket: WebSocket) {
        this.socket = socket;
        socket.addEventListener('message', (event) => this.onMessage(String(event.data)));
    }

    static async connect(webSocketUrl: string): Promise<CdpSession> {
        const socket = new WebSocket(webSocketUrl);
        await new Promise<void>((resolve, reject) => {
            socket.addEventListener('open', () => resolve(), { once: true });
            socket.addEventListener('error', () => reject(new Error('CDP connection failed')), {
                once: true,
            });
        });
        const session = new CdpSession(socket);
        await session.send('Runtime.enable');
        await session.send('Log.enable');
        await session.send('Page.enable');
        return session;
    }

    send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
        const id = ++this.nextId;
        this.socket.send(JSON.stringify({ id, method, params }));
        return new Promise((resolve, reject) => {
            this.pending.set(id, (message) =>
                message.error
                    ? reject(new Error(`${method}: ${message.error.message}`))
                    : resolve(message.result ?? {}),
            );
        });
    }

    /** Runs `expression` in the page (awaiting promises) and returns its JSON value. */
    async evaluate<T>(expression: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
        const result = await this.send('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true,
            timeout: timeoutMs,
        });
        const details = result.exceptionDetails as ExceptionDetails | undefined;
        if (details) {
            throw new Error(details.exception?.description ?? details.text ?? 'evaluate failed');
        }
        return (result.result as RemoteObject).value as T;
    }

    /** Polls `expression` until it returns a truthy value, and returns that value. */
    async waitFor<T>(
        expression: string,
        label: string,
        timeoutMs = DEFAULT_TIMEOUT_MS,
    ): Promise<T> {
        const deadline = Date.now() + timeoutMs;
        let lastError: unknown;
        while (Date.now() < deadline) {
            try {
                const value = await this.evaluate<T>(expression);
                if (value) return value;
            } catch (error) {
                lastError = error;
            }
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
        const reason = lastError instanceof Error ? ` (last error: ${lastError.message})` : '';
        throw new CdpTimeoutError(`Timed out after ${timeoutMs} ms waiting for ${label}${reason}`);
    }

    async screenshot(): Promise<Buffer> {
        const result = await this.send('Page.captureScreenshot', { format: 'png' });
        return Buffer.from(String(result.data), 'base64');
    }

    async reload(): Promise<void> {
        const loaded = this.nextEvent('Page.loadEventFired');
        await this.send('Page.reload', { ignoreCache: true });
        await loaded;
    }

    close(): void {
        this.socket.close();
    }

    private nextEvent(method: string): Promise<Record<string, unknown>> {
        return new Promise((resolve) => {
            const queue = this.listeners.get(method) ?? [];
            queue.push(resolve);
            this.listeners.set(method, queue);
        });
    }

    private onMessage(raw: string): void {
        const message = JSON.parse(raw) as CdpMessage;
        if (message.id !== undefined) {
            this.pending.get(message.id)?.(message);
            this.pending.delete(message.id);
            return;
        }
        if (!message.method) return;
        this.collectConsoleError(message.method, message.params ?? {});
        const waiting = this.listeners.get(message.method);
        this.listeners.delete(message.method);
        waiting?.forEach((resolve) => resolve(message.params ?? {}));
    }

    private collectConsoleError(method: string, params: Record<string, unknown>): void {
        if (method === 'Runtime.exceptionThrown') {
            const details = params.exceptionDetails as ExceptionDetails;
            this.consoleErrors.push(details.exception?.description ?? details.text ?? 'exception');
        }
        if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
            const args = params.args as RemoteObject[];
            this.consoleErrors.push(args.map((arg) => arg.value ?? arg.description).join(' '));
        }
        if (method === 'Log.entryAdded') {
            const entry = params.entry as { level: string; text: string };
            if (entry.level === 'error') this.consoleErrors.push(entry.text);
        }
    }
}
