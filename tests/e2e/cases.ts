import { MOCK_MAX_COMPLETION_TOKENS } from './mock-llm/scenario';
import { LONG_RESEARCH_TOOL_STEPS } from './mock-llm/scenarios';
import { lastAssistantText, type CaseContext, type E2eCase } from './case-runner';
import type { ChatFacts } from './driver/chat-page';

const hasAssistantText = (facts: ChatFacts) => lastAssistantText(facts).length > 0;
const hasToolTags = (facts: ChatFacts) => facts.toolTags.length > 0;
const isIdle = (facts: ChatFacts) => !facts.stopButton;

async function sendAndCapture(
    ctx: CaseContext,
    message: string,
    midRun: { state: string; when: (facts: ChatFacts) => boolean } | null,
): Promise<ChatFacts> {
    await ctx.page.send(message);
    if (midRun) {
        await ctx.waitUntil((f) => midRun.when(f) || isIdle(f), midRun.state);
        if (!isIdle(await ctx.page.facts())) await ctx.shot(midRun.state);
    }
    const final = await ctx.waitForRunEnd();
    return final;
}

function checkCleanEnd(ctx: CaseContext, final: ChatFacts, marker: string): void {
    ctx.check('the answer is shown in full', lastAssistantText(final).includes(marker), {
        answer: lastAssistantText(final).slice(-200),
    });
    ctx.check('no error banner', final.errorAlerts.length === 0, final.errorAlerts);
    ctx.check('the input is ready again (no Stop button)', !final.stopButton);
}

const RAW_ERROR_BUG = 'B15 provider errors are shown raw, in English';

function checkErrorShown(
    ctx: CaseContext,
    final: ChatFacts,
    cause: RegExp,
    causeInFrench: RegExp,
    retryKnownBug?: string,
): void {
    const alerts = final.errorAlerts;
    ctx.check('an error banner is shown', alerts.length > 0, alerts);
    ctx.check(
        `the error names the cause (${cause})`,
        alerts.some((a) => cause.test(a)),
        alerts,
    );
    ctx.check(
        `the error is written in French (${causeInFrench})`,
        alerts.some((a) => causeInFrench.test(a)),
        alerts,
        { knownBug: RAW_ERROR_BUG },
    );
    ctx.check('a Retry button is offered', final.retryButtons > 0, final.retryButtons, {
        knownBug: retryKnownBug,
    });
    ctx.check('the input is ready again (no Stop button)', !final.stopButton);
}

const normal: E2eCase = {
    name: 'normal',
    description: 'One tool call, then a streamed markdown answer',
    async run(ctx) {
        const final = await sendAndCapture(ctx, 'Que dit-il en 1963 ? #scenario:normal', {
            state: 'streaming',
            when: hasAssistantText,
        });
        await ctx.shot('done');
        checkCleanEnd(ctx, final, 'MOCK-NORMAL-DONE');
        ctx.check('a tool tag was visible during the run', ctx.everSeen(hasToolTags));
        ctx.check('the reasoning block is shown', final.reasoningBlocks > 0);
        const requests = ctx.requests().filter((r) => r.scenario === 'normal');
        ctx.check(
            'the model was called twice (tool step + answer)',
            requests.length === 2,
            requests.length,
        );
        ctx.check(
            `every chat request sets max_tokens within the model limit (${MOCK_MAX_COMPLETION_TOKENS})`,
            requests.every(
                (r) => (r.maxTokens ?? 0) > 0 && (r.maxTokens ?? 0) <= MOCK_MAX_COMPLETION_TOKENS,
            ),
            requests.map((r) => r.maxTokens),
        );
    },
};

const longResearch: E2eCase = {
    name: 'long-research',
    description: `${LONG_RESEARCH_TOOL_STEPS} tool steps over real sermon tools`,
    async run(ctx) {
        const final = await sendAndCapture(ctx, 'Recherche complète #scenario:long-research', {
            state: 'tools-running',
            when: (f) => f.toolTags.length >= 2,
        });
        await ctx.shot('done');
        checkCleanEnd(ctx, final, 'MOCK-LONG-RESEARCH-DONE');
        const requests = ctx.requests().filter((r) => r.scenario === 'long-research');
        ctx.check(
            `the model was called ${LONG_RESEARCH_TOOL_STEPS + 1} times`,
            requests.length === LONG_RESEARCH_TOOL_STEPS + 1,
            requests.length,
        );
        const last = requests[requests.length - 1];
        ctx.check(
            'the last request carries every tool result',
            last?.toolResultCount === LONG_RESEARCH_TOOL_STEPS,
            {
                toolResultCount: last?.toolResultCount,
                toolResultChars: last?.toolResultChars,
            },
        );
    },
};

const reasoningHeavy: E2eCase = {
    name: 'reasoning-heavy',
    description: 'Long reasoning around a tool call',
    async run(ctx) {
        const final = await sendAndCapture(ctx, 'Réfléchis bien #scenario:reasoning-heavy', {
            state: 'reasoning',
            when: (f) => f.reasoningBlocks > 0,
        });
        await ctx.shot('done');
        checkCleanEnd(ctx, final, 'MOCK-REASONING-DONE');
        ctx.check('the reasoning block is shown', final.reasoningBlocks > 0);
    },
};

const length: E2eCase = {
    name: 'length',
    description: 'Answer cut by finish_reason "length"',
    async run(ctx) {
        const final = await sendAndCapture(ctx, 'Une longue réponse #scenario:length', null);
        await ctx.shot('truncated');
        const answer = lastAssistantText(final);
        ctx.check(
            'the partial answer is kept',
            answer.includes('MOCK-LENGTH-TEXT'),
            answer.slice(-200),
        );
        ctx.check(
            'the user is told the answer was cut',
            /truncated|tronqu|coupé/i.test(answer),
            answer.slice(-200),
        );
        ctx.check(
            'the truncation notice is in the UI language (French)',
            /tronqu|coupé|interromp/i.test(answer),
            answer.slice(-120),
            { knownBug: 'B4/G6 truncation notice is English and not a real banner' },
        );
        ctx.check('no error banner', final.errorAlerts.length === 0, final.errorAlerts);
    },
};

const lengthEmpty: E2eCase = {
    name: 'length-empty',
    description: 'Budget spent on reasoning: no answer text, finish_reason "length"',
    async run(ctx) {
        const final = await sendAndCapture(ctx, 'Question difficile #scenario:length-empty', null);
        await ctx.shot('truncated-empty');
        const answer = lastAssistantText(final);
        const withoutNotice = answer.replace(/Voir le raisonnement|Masquer le raisonnement/g, '');
        ctx.check(
            'the user gets an answer, not only a truncation notice',
            /\w{20,}/.test(withoutNotice.replace(/Response truncated due to length limit/i, '')),
            answer.slice(0, 300),
            { knownBug: 'B1/B3 empty answer when reasoning uses the whole output budget' },
        );
        ctx.check('the input is ready again (no Stop button)', !final.stopButton);
    },
};

function httpErrorCase(
    name: string,
    description: string,
    errorPatterns: { cause: RegExp; causeInFrench: RegExp },
    expectedRequests: number,
): E2eCase {
    return {
        name,
        description,
        async run(ctx) {
            const final = await sendAndCapture(ctx, `Bonjour #scenario:${name}`, null);
            await ctx.shot('error');
            checkErrorShown(ctx, final, errorPatterns.cause, errorPatterns.causeInFrench);
            ctx.check(
                'the user message is kept',
                final.messages.some((m) => m.role === 'user'),
            );
            const requests = ctx.requests().filter((r) => r.scenario === name);
            ctx.check(
                `the app called the model ${expectedRequests} time(s)`,
                requests.length === expectedRequests,
                requests.length,
            );
        },
    };
}

const drop: E2eCase = {
    name: 'drop',
    description: 'Connection lost mid-stream',
    async run(ctx) {
        const final = await sendAndCapture(ctx, 'Coupure réseau #scenario:drop', {
            state: 'streaming',
            when: hasAssistantText,
        });
        await ctx.shot('error');
        ctx.check(
            'the partial answer is kept',
            final.messages.some((m) => m.role === 'assistant' && m.text.includes('MOCK-DROP-TEXT')),
            lastAssistantText(final).slice(-200),
        );
        checkErrorShown(
            ctx,
            final,
            /response|connection|terminated/i,
            /connexion|réseau/i,
            'G6 no Retry once part of the answer was streamed',
        );
    },
};

const slowFirstToken: E2eCase = {
    name: 'slow-first-token',
    description: 'First token after 8 s',
    async run(ctx) {
        const final = await sendAndCapture(ctx, 'Patience #scenario:slow-first-token #delay=8000', {
            state: 'waiting',
            when: (f) => f.spinner,
        });
        await ctx.shot('done');
        ctx.check(
            'a waiting indicator was visible',
            ctx.everSeen((f) => f.spinner),
        );
        checkCleanEnd(ctx, final, 'MOCK-SLOW-DONE');
    },
};

const stopDuringText: E2eCase = {
    name: 'stop-during-text',
    description: 'Stop button pressed while the answer streams',
    async run(ctx) {
        await ctx.page.send('Longue réponse #scenario:slow-stream');
        await ctx.waitUntil((f) => lastAssistantText(f).length > 80, 'streamed text');
        await ctx.shot('streaming');
        await ctx.page.clickStop();
        const final = await ctx.waitForRunEnd(15_000);
        await ctx.shot('stopped');
        const answer = lastAssistantText(final);
        ctx.check('the partial answer is kept', answer.length > 80, answer.slice(0, 120));
        ctx.check('the answer did not finish', !answer.includes('MOCK-SLOW-STREAM-DONE'));
        ctx.check('no error banner', final.errorAlerts.length === 0, final.errorAlerts);
        const lastRequest = ctx
            .requests()
            .filter((r) => r.scenario === 'slow-stream')
            .pop();
        ctx.check(
            'the HTTP stream was closed',
            lastRequest?.outcome === 'client-closed',
            lastRequest?.outcome,
        );
    },
};

const stopBeforeFirstToken: E2eCase = {
    name: 'stop-before-first-token',
    description: 'Stop button pressed while waiting for the first token',
    async run(ctx) {
        await ctx.page.send('Attente #scenario:slow-first-token #delay=20000');
        await ctx.waitUntil((f) => f.spinner, 'waiting indicator');
        await ctx.page.clickStop();
        const final = await ctx.waitForRunEnd(15_000);
        await ctx.shot('stopped');
        ctx.check('no error banner', final.errorAlerts.length === 0, final.errorAlerts);
        ctx.check(
            'the user message is kept',
            final.messages.some((m) => m.role === 'user'),
        );
        const closed = await ctx.waitForRequest((r) => r.outcome === 'client-closed');
        ctx.check(
            'the HTTP request was closed',
            Boolean(closed),
            ctx.requests().map((r) => r.outcome),
        );
    },
};

const subagent: E2eCase = {
    name: 'subagent',
    description: 'researchTopic sub-agent runs its own tool loop',
    async run(ctx) {
        const final = await sendAndCapture(ctx, 'Étude approfondie #scenario:subagent', {
            state: 'subagent-running',
            when: (f) => f.toolTags.some((tag) => tag.includes('Recherche approfondie')),
        });
        await ctx.shot('done');
        checkCleanEnd(ctx, final, 'MOCK-SUBAGENT-DONE');
        const worker = ctx.requests().filter((r) => r.scenario === 'research-worker');
        ctx.check('the sub-agent made 3 model calls', worker.length === 3, worker.length);
        ctx.check(
            'the final answer saw the research report',
            lastAssistantText(final).includes('reported back'),
        );
    },
};

const title: E2eCase = {
    name: 'title',
    description: 'Two exchanges, then the AI title replaces the first message',
    async run(ctx) {
        await sendAndCapture(ctx, 'Première question', null);
        await sendAndCapture(ctx, 'Deuxième question', null);
        const final = await ctx
            .waitUntil(
                (f) => f.activeTitle === 'Mock conversation title',
                'the generated title',
                20_000,
            )
            .catch(() => ctx.page.facts());
        await ctx.shot('titled');
        ctx.check(
            'the conversation gets the generated title',
            final.activeTitle === 'Mock conversation title',
            final.activeTitle,
        );
        ctx.check(
            'the title request was sent',
            ctx.requests().some((r) => r.scenario === 'title'),
        );
    },
};

interface AnswerLinks {
    anchors: string[];
    referenceTags: string[];
    images: number;
    pageUrl: string;
    pixelRequested: boolean;
}

const READ_LAST_ANSWER_LINKS = `(() => {
    const bubbles = document.querySelectorAll('.ai-chat__bubble:not(.ai-chat__bubble--user)');
    const answer = bubbles[bubbles.length - 1];
    return {
        anchors: [...(answer?.querySelectorAll('a[href]') ?? [])].map((a) => a.getAttribute('href')),
        referenceTags: [...(answer?.querySelectorAll('[data-href]') ?? [])].map((el) => el.getAttribute('data-href')),
        images: answer?.querySelectorAll('img').length ?? 0,
        pageUrl: location.href,
        pixelRequested: performance.getEntriesByType('resource').some((entry) => entry.name.includes('leak.example.invalid')),
    };
})()`;

async function waitForLog(ctx: CaseContext, pattern: RegExp, timeoutMs = 5000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (pattern.test(ctx.mainLog())) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
}

const unsafeLinks: E2eCase = {
    name: 'unsafe-links',
    description: 'Model links: only wmb://, web and mail links are clickable; images never load',
    async run(ctx) {
        const final = await sendAndCapture(ctx, 'Donne des liens #scenario:unsafe-links', null);
        await ctx.shot('done');
        checkCleanEnd(ctx, final, 'MOCK-LINKS-DONE');

        const links = await ctx.page.evaluate<AnswerLinks>(READ_LAST_ANSWER_LINKS);
        ctx.check(
            'the wmb:// reference is an in-app tag',
            links.referenceTags.includes('wmb://sermon/63-0318/tur/1/1'),
            links.referenceTags,
        );
        ctx.check(
            'only the web and mail links are real links',
            JSON.stringify(links.anchors) ===
                JSON.stringify(['https://wmb-table.web.app/', 'mailto:contact@example.com']),
            links.anchors,
        );
        const answer = lastAssistantText(final);
        ctx.check(
            'refused links stay visible as plain text',
            ['RELATIVE-LINK', 'FILE-LINK', 'SCRIPT-LINK', 'IMAGE-ALT'].every((label) =>
                answer.includes(label),
            ),
            answer.slice(0, 400),
        );
        ctx.check('the image is not rendered', links.images === 0, links.images);
        ctx.check('the remote image was never requested', !links.pixelRequested);

        const externalLogLines = () => (ctx.mainLog().match(/\[external\]/g) ?? []).length;
        const externalBefore = externalLogLines();
        for (const label of ['RELATIVE-LINK', 'FILE-LINK', 'SCRIPT-LINK', 'IMAGE-ALT']) {
            await ctx.page.clickInLastAnswer(label);
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        const afterClicks = await ctx.page.evaluate<AnswerLinks>(READ_LAST_ANSWER_LINKS);
        ctx.check(
            'clicking refused links leaves the app page in place',
            afterClicks.pageUrl === links.pageUrl,
            afterClicks.pageUrl,
        );
        ctx.check(
            'clicking refused links asks main to open nothing',
            externalLogLines() === externalBefore,
        );
    },
};

const tooLongMessage: E2eCase = {
    name: 'too-long-message',
    description: 'A message over 100 000 characters is refused in French, with no model call',
    async run(ctx) {
        await ctx.page.send(`${'a'.repeat(100_001)} #scenario:echo`);
        const final = await ctx.waitUntil(
            (f) => f.errorAlerts.length > 0,
            'an error banner',
            15_000,
        );
        await ctx.shot('refused');
        ctx.check(
            'the error says the message is too long, in French, with no technical prefix',
            final.errorAlerts.some((alert) => alert.startsWith('Le message est trop long')),
            final.errorAlerts,
        );
        ctx.check('the model was not called', ctx.requests().length === 0, ctx.requests().length);
    },
};

const navigationGuard: E2eCase = {
    name: 'navigation-guard',
    description: 'Main refuses unsafe external links and keeps the app page from navigating away',
    async run(ctx) {
        await sendAndCapture(ctx, 'Bonjour', null);
        const before = await ctx.page.evaluate<string>('location.href');
        await ctx.page.evaluate(`window.open('file:///etc/passwd') === null`);
        ctx.check(
            'window.open of a file: URL is refused and logged with its scheme only',
            await waitForLog(ctx, /Refused to open a link \(file:\) from window-open/),
        );
        await ctx.page.evaluate(`window.api.app.openExternal('javascript:alert(1)')`);
        ctx.check(
            'the openExternal IPC refuses a javascript: URL',
            await waitForLog(ctx, /Refused to open a link \(javascript:\) from ipc/),
        );
        await ctx.page.evaluate(`void (location.href = 'https://example.invalid/away')`);
        ctx.check(
            'navigating the app window away is blocked',
            await waitForLog(ctx, /Blocked navigation of the app window \(https:\)/),
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        const after = await ctx.page.evaluate<string>('location.href');
        ctx.check('the app page is still loaded', after === before, after);
        ctx.check(
            'the log holds no refused URL',
            !/etc\/passwd|example\.invalid/.test(ctx.mainLog()),
        );
        const final = await ctx.page.facts();
        ctx.check('the chat is still usable', !final.stopButton && final.errorAlerts.length === 0);
    },
};

export const cases: E2eCase[] = [
    normal,
    longResearch,
    reasoningHeavy,
    length,
    lengthEmpty,
    httpErrorCase('401', 'Wrong API key', { cause: /api key/i, causeInFrench: /clé API/i }, 1),
    httpErrorCase('404', 'Model not found', { cause: /model/i, causeInFrench: /modèle/i }, 1),
    httpErrorCase(
        '500',
        'Server error on every try (the app retries)',
        { cause: /server/i, causeInFrench: /serveur/i },
        4,
    ),
    drop,
    slowFirstToken,
    stopDuringText,
    stopBeforeFirstToken,
    subagent,
    title,
    unsafeLinks,
    navigationGuard,
    // Last: the refused message stays queued, so "new conversation" reuses this empty one (U20, U27).
    tooLongMessage,
];
