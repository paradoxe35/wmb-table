import type { ChatFacts, ChatPage } from './driver/chat-page';
import type { MockLlmServer, RecordedRequest } from './mock-llm/server';

export interface CheckOptions {
    /** The app is known to fail this today; the id points at the review finding. */
    knownBug?: string;
}

export type CheckStatus = 'pass' | 'fail' | 'known-bug' | 'bug-fixed';

export interface CheckResult {
    label: string;
    status: CheckStatus;
    details?: string;
    knownBug?: string;
}

export interface CaseResult {
    name: string;
    durationMs: number;
    checks: CheckResult[];
    screenshots: string[];
    error?: string;
    finalFacts?: ChatFacts;
}

export interface E2eCase {
    name: string;
    description: string;
    run(ctx: CaseContext): Promise<void>;
}

export const DONE_TIMEOUT_MS = 90_000;

function checkStatus(passed: boolean, knownBug: string | undefined): CheckStatus {
    if (knownBug) return passed ? 'bug-fixed' : 'known-bug';
    return passed ? 'pass' : 'fail';
}

export class CaseContext {
    readonly page: ChatPage;
    readonly checks: CheckResult[] = [];
    readonly screenshots: string[] = [];
    /** Every distinct state the chat showed while the case waited. */
    readonly timeline: ChatFacts[] = [];
    private readonly server: MockLlmServer;
    private readonly firstRequestIndex: number;
    private readonly caseName: string;

    constructor(caseName: string, page: ChatPage, server: MockLlmServer) {
        this.caseName = caseName;
        this.page = page;
        this.server = server;
        this.firstRequestIndex = server.requests.length;
    }

    /** Requests the mock server received since this case started. */
    requests(): RecordedRequest[] {
        return this.server.requests.slice(this.firstRequestIndex);
    }

    check(label: string, passed: boolean, details?: unknown, options: CheckOptions = {}): void {
        this.checks.push({
            label,
            status: checkStatus(passed, options.knownBug),
            details: details === undefined ? undefined : JSON.stringify(details).slice(0, 600),
            knownBug: options.knownBug,
        });
    }

    async shot(state: string): Promise<void> {
        this.screenshots.push(
            ...(await this.page.screenshotBothThemes(`${this.caseName}-${state}`)),
        );
    }

    async waitUntil(
        predicate: (facts: ChatFacts) => boolean,
        label: string,
        timeoutMs = DONE_TIMEOUT_MS,
    ): Promise<ChatFacts> {
        return this.page.waitForFacts(
            (facts) => {
                this.record(facts);
                return predicate(facts);
            },
            label,
            timeoutMs,
        );
    }

    /** Waits until the run is over: the Stop button is gone. */
    waitForRunEnd(timeoutMs = DONE_TIMEOUT_MS): Promise<ChatFacts> {
        return this.waitUntil((facts) => !facts.stopButton, 'the run to end', timeoutMs);
    }

    async waitForRequest(
        predicate: (request: RecordedRequest) => boolean,
        timeoutMs = 5000,
    ): Promise<RecordedRequest | undefined> {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const found = this.requests().find(predicate);
            if (found) return found;
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return undefined;
    }

    everSeen(predicate: (facts: ChatFacts) => boolean): boolean {
        return this.timeline.some(predicate);
    }

    private record(facts: ChatFacts): void {
        const last = this.timeline[this.timeline.length - 1];
        if (!last || JSON.stringify(last) !== JSON.stringify(facts)) this.timeline.push(facts);
    }
}

export function lastAssistantText(facts: ChatFacts): string {
    const assistant = facts.messages.filter((message) => message.role === 'assistant');
    return assistant[assistant.length - 1]?.text ?? '';
}
