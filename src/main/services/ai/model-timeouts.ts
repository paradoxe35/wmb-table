const SECOND = 1_000;
const MINUTE = 60 * SECOND;

export interface ChatTimeouts {
    totalMs: number;
    stepMs: number;
    firstChunkMs: number;
    chunkMs: number;
    toolMs: number;
    /** Sub-agents run a whole tool loop of their own inside one tool call. */
    agentToolMs: number;
}

const REMOTE_CHAT_TIMEOUTS: ChatTimeouts = {
    totalMs: 30 * MINUTE,
    stepMs: 15 * MINUTE,
    firstChunkMs: 3 * MINUTE,
    chunkMs: 2 * MINUTE,
    toolMs: 2 * MINUTE,
    agentToolMs: 12 * MINUTE,
};

/** A model on a CPU can take minutes to read a long prompt before its first token. */
const LOCAL_CHAT_TIMEOUTS: ChatTimeouts = {
    totalMs: 90 * MINUTE,
    stepMs: 45 * MINUTE,
    firstChunkMs: 15 * MINUTE,
    chunkMs: 5 * MINUTE,
    toolMs: 2 * MINUTE,
    agentToolMs: 40 * MINUTE,
};

/** A sub-agent returns before the chat's own limit for its tool call cuts it off, and keeps the
 * last part of that time for writing its report. */
const SUB_AGENT_RESEARCH_SHARE = 0.75;
const SUB_AGENT_DEADLINE_SHARE = 0.95;

export interface SubAgentDeadlines {
    wrapUpAt: number;
    deadline: number;
}

export function resolveSubAgentDeadlines(
    timeouts: ChatTimeouts,
    startedAt: number,
): SubAgentDeadlines {
    return {
        wrapUpAt: startedAt + Math.floor(timeouts.agentToolMs * SUB_AGENT_RESEARCH_SHARE),
        deadline: startedAt + Math.floor(timeouts.agentToolMs * SUB_AGENT_DEADLINE_SHARE),
    };
}

export const TITLE_TIMEOUT_MS = 2 * MINUTE;
const REMOTE_PROVIDER_TEST_TIMEOUT_MS = 30 * SECOND;
const LOCAL_PROVIDER_TEST_TIMEOUT_MS = 3 * MINUTE;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

export function isLocalProvider(providerId: string, baseUrl: string | undefined): boolean {
    if (providerId === 'ollama') return true;
    if (!baseUrl) return false;
    try {
        const { hostname } = new URL(baseUrl);
        return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith('.local');
    } catch {
        return false;
    }
}

export function resolveChatTimeouts(local: boolean): ChatTimeouts {
    return local ? LOCAL_CHAT_TIMEOUTS : REMOTE_CHAT_TIMEOUTS;
}

export function resolveProviderTestTimeoutMs(local: boolean): number {
    return local ? LOCAL_PROVIDER_TEST_TIMEOUT_MS : REMOTE_PROVIDER_TEST_TIMEOUT_MS;
}

export type AiTimeoutKind = 'first-chunk' | 'chunk' | 'step' | 'total';

export const AI_TIMEOUT_MESSAGE =
    "Le modèle n'a pas répondu à temps. Réessayez, ou choisissez un modèle plus rapide dans les paramètres.";

export class AiTimeoutError extends Error {
    constructor(readonly kind: AiTimeoutKind) {
        super(AI_TIMEOUT_MESSAGE);
        this.name = 'AiTimeoutError';
    }
}

function describeReason(reason: unknown): string {
    if (reason instanceof Error || reason instanceof DOMException) {
        return `${reason.name}: ${reason.message}`;
    }
    return String(reason ?? '');
}

/** The SDK reports its own timeouts as a `TimeoutError` abort, sometimes only as text. */
export function isTimeoutReason(reason: unknown): boolean {
    return /TimeoutError|timed? ?out/i.test(describeReason(reason));
}

export function timeoutKindOf(reason: unknown): AiTimeoutKind {
    const text = describeReason(reason);
    if (/first chunk/i.test(text)) return 'first-chunk';
    if (/chunk/i.test(text)) return 'chunk';
    if (/step/i.test(text)) return 'step';
    return 'total';
}
