import { MOCK_CONTEXT_WINDOW, MOCK_MAX_COMPLETION_TOKENS } from './mock-llm/scenario';
import { LONG_RESEARCH_TOOL_STEPS, OVERFLOW_TOOL_STEPS } from './mock-llm/scenarios';
import { lastAssistantText, type CaseContext, type E2eCase } from './case-runner';
import type { ChatFacts } from './driver/chat-page';
import { lifecycleCases } from './lifecycle-cases';

const hasAssistantText = (facts: ChatFacts) => lastAssistantText(facts).length > 0;
const TRUNCATION_NOTICE_FR = /Réponse coupée/;
const ENGLISH_TRUNCATION_TEXT = /Response truncated/i;
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

function checkErrorShown(
    ctx: CaseContext,
    final: ChatFacts,
    cause: RegExp,
    causeInFrench: RegExp,
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
    );
    ctx.check('a Retry button is offered', final.retryButtons > 0, final.retryButtons);
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
        ctx.check(
            `the answer may use the model's full output (${MOCK_MAX_COMPLETION_TOKENS}), not a fixed 8192`,
            requests[requests.length - 1]?.maxTokens === MOCK_MAX_COMPLETION_TOKENS,
            requests.map((r) => r.maxTokens),
        );
        ctx.check(
            'no reasoning effort goes to a model whose list does not offer it',
            requests.every((r) => r.reasoningEffort === null),
            requests.map((r) => r.reasoningEffort),
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
    description: 'Answer cut by finish_reason "length", then continued automatically',
    async run(ctx) {
        const final = await sendAndCapture(ctx, 'Une longue réponse #scenario:length', null);
        await ctx.shot('continued');
        const answer = lastAssistantText(final);
        ctx.check('the cut part is kept', answer.includes('MOCK-LENGTH-TEXT'), answer.slice(-200));
        ctx.check(
            'the continuation finishes the answer right after the cut',
            answer.includes('MOCK-LENGTH-TEXT and the rest of the answer. MOCK-LENGTH-DONE'),
            answer.slice(-200),
        );
        ctx.check(
            'no truncation notice once the answer is complete',
            !TRUNCATION_NOTICE_FR.test(answer) && !ENGLISH_TRUNCATION_TEXT.test(answer),
            answer.slice(-200),
        );
        const requests = ctx.requests().filter((r) => r.scenario === 'length');
        ctx.check('one continuation request was made', requests.length === 2, requests.length);
        ctx.check(
            'the continuation runs without tools',
            requests[1]?.toolChoice === 'none' && requests[1]?.reasoningEffort === null,
            requests.map((r) => [r.toolChoice, r.reasoningEffort]),
        );
        ctx.check('no error banner', final.errorAlerts.length === 0, final.errorAlerts);
    },
};

const lengthAlways: E2eCase = {
    name: 'length-always',
    description: 'Answer still cut after two continuations: a translated notice',
    async run(ctx) {
        const final = await sendAndCapture(
            ctx,
            'Une réponse sans fin #scenario:length-always',
            null,
        );
        await ctx.shot('truncated');
        const answer = lastAssistantText(final);
        ctx.check(
            'every cut part is kept',
            (answer.match(/MOCK-LENGTH-PART/g) ?? []).length === 3,
            answer.slice(-200),
        );
        ctx.check(
            'the user is told the answer was cut',
            /tronqu|coupé/i.test(answer),
            answer.slice(-200),
        );
        ctx.check(
            'the truncation notice is in the UI language (French)',
            TRUNCATION_NOTICE_FR.test(answer) && !ENGLISH_TRUNCATION_TEXT.test(answer),
            answer.slice(-120),
        );
        const requests = ctx.requests().filter((r) => r.scenario === 'length-always');
        ctx.check('two continuations, then it stops', requests.length === 3, requests.length);
        ctx.check('no error banner', final.errorAlerts.length === 0, final.errorAlerts);
    },
};

const lengthEmpty: E2eCase = {
    name: 'length-empty',
    description: 'Budget spent on reasoning: no answer text, finish_reason "length"',
    async run(ctx) {
        const final = await sendAndCapture(ctx, 'Question difficile #scenario:length-empty', null);
        await ctx.shot('answered');
        const answer = lastAssistantText(final);
        const withoutNotice = answer.replace(/Voir le raisonnement|Masquer le raisonnement/g, '');
        ctx.check(
            'the user gets an answer, not only a truncation notice',
            withoutNotice.includes('MOCK-LENGTH-EMPTY-DONE') &&
                !TRUNCATION_NOTICE_FR.test(answer) &&
                !ENGLISH_TRUNCATION_TEXT.test(answer),
            answer.slice(0, 300),
        );
        ctx.check('the input is ready again (no Stop button)', !final.stopButton);
    },
};

/** The ratio tokenx, the app estimator, uses for this text; real tokenizers give fewer tokens. */
const MOCK_CONTEXT_CHARS_PER_TOKEN = 3.5;

const researchOverflow: E2eCase = {
    name: 'research-overflow',
    description: `${OVERFLOW_TOOL_STEPS} big sermon reads, more than the model window holds`,
    async run(ctx) {
        const final = await sendAndCapture(ctx, 'Lis beaucoup #scenario:research-overflow', {
            state: 'tools-running',
            when: (f) => f.toolTags.length >= 2,
        });
        await ctx.shot('done');
        checkCleanEnd(ctx, final, 'MOCK-OVERFLOW-DONE');
        const requests = ctx.requests().filter((r) => r.scenario === 'research-overflow');
        const raw = requests.reduce((sum, r) => sum + (r.toolResultChars > 0 ? 1 : 0), 0);
        ctx.check('the research ran through its tool steps', raw >= OVERFLOW_TOOL_STEPS - 2, raw);
        ctx.check(
            'older tool results were condensed',
            requests.some((r) => r.condensedToolResults > 0),
            requests.map((r) => r.condensedToolResults),
        );
        const largest = Math.max(...requests.map((r) => r.promptChars));
        ctx.check(
            `no request outgrew the 128k-token window (largest ${largest} chars)`,
            largest / MOCK_CONTEXT_CHARS_PER_TOKEN + MOCK_MAX_COMPLETION_TOKENS <
                MOCK_CONTEXT_WINDOW,
            largest,
        );
        const readChars = Math.max(...requests.map((r) => r.lastToolResultChars));
        ctx.check(
            'without condensing, the reads alone would not have fit',
            (readChars * OVERFLOW_TOOL_STEPS) / MOCK_CONTEXT_CHARS_PER_TOKEN > MOCK_CONTEXT_WINDOW,
            readChars,
        );
        ctx.check(
            "the app's own estimate stayed under its prompt limit",
            [...ctx.mainLog().matchAll(/largestPromptTokens: (\d+),\s+promptLimit: (\d+)/g)].every(
                ([, largestTokens, limit]) => Number(largestTokens) <= Number(limit),
            ),
        );
    },
};

const stepLimit: E2eCase = {
    name: 'step-limit',
    description: 'The model never stops calling tools: the last step must write the answer',
    async run(ctx) {
        const final = await sendAndCapture(ctx, 'Cherche sans fin #scenario:step-limit', null);
        await ctx.shot('done');
        checkCleanEnd(ctx, final, 'MOCK-STEP-LIMIT-DONE');
        const requests = ctx.requests().filter((r) => r.scenario === 'step-limit');
        ctx.check('the run stopped at the 50-step limit', requests.length === 50, requests.length);
        const last = requests[requests.length - 1];
        ctx.check(
            'the last step had its tools closed',
            last?.toolChoice === 'none' && last?.reasoningEffort === null,
            [last?.toolChoice, last?.reasoningEffort],
        );
        ctx.check(
            'the app logged that the step limit was reached',
            /stepLimitReached: true/.test(ctx.mainLog()),
        );
    },
};

const bible: E2eCase = {
    name: 'bible',
    description: 'Bible search, then the passage, then an answer citing it',
    async run(ctx) {
        const final = await sendAndCapture(
            ctx,
            'Qui t’a dit que tu étais nu ? #scenario:bible',
            null,
        );
        await ctx.shot('done');
        checkCleanEnd(ctx, final, 'MOCK-BIBLE-DONE');
        const answer = lastAssistantText(final);
        ctx.check(
            'the answer cites the passage the tool returned',
            /Passage read: \S.* \d+:\d+\./.test(answer),
            answer.slice(0, 200),
        );
        const requests = ctx.requests().filter((r) => r.scenario === 'bible');
        ctx.check('search, passage and answer: 3 calls', requests.length === 3, requests.length);
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
        checkErrorShown(ctx, final, /response|connection|terminated/i, /connexion|réseau/i);
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
        await ctx.page.typeAndPressEnter(`${'a'.repeat(100_001)} #scenario:echo`);
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
        const leftOver = await ctx.page.evaluate<{ draft: number; queued: number }>(
            `({ draft: document.querySelector('textarea.ai-chat__input-textarea').value.length, queued: document.querySelectorAll('.ai-chat__queue-item').length })`,
        );
        ctx.check(
            'the message stays in the input to be shortened, and nothing is queued (U20)',
            leftOver.draft > 100_000 && leftOver.queued === 0,
            leftOver,
        );
        await ctx.page.clearInput();
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

const noticeText = (ctx: CaseContext) => ctx.page.noticeTexts().then((texts) => texts.join(' | '));
const lastUserText = (facts: ChatFacts) =>
    facts.messages.filter((m) => m.role === 'user').pop()?.text ?? '';

const switchMidRun: E2eCase = {
    name: 'switch-mid-run',
    description: 'Switching conversation while an answer is coming does not pull the user back',
    async run(ctx) {
        await ctx.page.send('Bascule pendant la réponse #scenario:slow-first-token #delay=4000');
        await ctx.waitUntil((f) => f.spinner, 'waiting indicator');
        await ctx.page.startNewConversation();
        const request = await ctx.waitForRequest(
            (r) => r.scenario === 'slow-first-token' && r.outcome === 'completed',
            15_000,
        );
        await new Promise((resolve) => setTimeout(resolve, 800));
        const onOther = await ctx.page.facts();
        await ctx.shot('other-conversation');
        ctx.check('the first answer finished in the background', Boolean(request));
        ctx.check(
            'the user stays on the conversation they opened',
            onOther.messages.length === 0 && !onOther.activeTitle?.includes('Bascule'),
            { title: onOther.activeTitle, messages: onOther.messages.length },
        );
        ctx.check('the other conversation shows no Stop button', !onOther.stopButton);
        await ctx.page.openConversation('Bascule pendant');
        const back = await ctx.waitUntil(
            (f) => lastAssistantText(f).includes('MOCK-SLOW-DONE'),
            'the finished answer',
            10_000,
        );
        ctx.check('the first conversation holds its full answer', hasAssistantText(back));
        ctx.check('no error banner', back.errorAlerts.length === 0, back.errorAlerts);
    },
};

const continueAfterCut: E2eCase = {
    name: 'continue-after-cut',
    description:
        'The "Continuer" button of a cut answer asks for the rest in the same conversation',
    async run(ctx) {
        await sendAndCapture(ctx, 'Une réponse sans fin #scenario:length-always', null);
        ctx.check('the cut banner is shown', /Réponse coupée/.test(await noticeText(ctx)));
        await ctx.shot('truncated-banner');
        const before = ctx.requests().length;
        await ctx.page.clickNoticeButton('Continuer');
        await ctx.waitUntil(
            (f) => ctx.requests().length > before && !f.stopButton,
            'the continue run',
        );
        const final = await ctx.waitForRunEnd();
        await ctx.shot('continued');
        ctx.check(
            'a continue request was sent as a user message in this conversation',
            lastUserText(final).includes("Continue ta réponse là où elle s'est arrêtée."),
            lastUserText(final),
        );
        ctx.check('the model was called again', ctx.requests().length > before);
        ctx.check(
            'the earlier answer is still there',
            final.messages.filter((m) => m.role === 'assistant').length >= 2,
        );
    },
};

const retryAfterDrop: E2eCase = {
    name: 'retry-after-drop',
    description: 'Réessayer after a dropped connection asks for the answer again',
    async run(ctx) {
        await sendAndCapture(ctx, 'Coupure puis relance #scenario:drop', null);
        const before = ctx.requests().length;
        await ctx.page.clickNoticeButton('Réessayer');
        const final = await ctx.waitUntil(
            (f) => ctx.requests().length > before && !f.stopButton,
            'the retried run',
        );
        await ctx.shot('retried');
        ctx.check('the model was called again', ctx.requests().length > before, {
            before,
            after: ctx.requests().length,
        });
        ctx.check(
            'the partial answer stays, and the follow-up asks to resume it',
            final.messages.some((m) => m.text.includes('MOCK-DROP-TEXT')) &&
                lastUserText(final).includes('Continue ta réponse'),
            lastUserText(final),
        );
    },
};

const stopAtOnce: E2eCase = {
    name: 'stop-at-once',
    description: 'Stop pressed right after sending, before main confirmed the run',
    async run(ctx) {
        await ctx.page.send('Arrêt immédiat #scenario:slow-first-token #delay=20000');
        await ctx.page.clickStop();
        const final = await ctx.waitForRunEnd(15_000);
        await ctx.shot('stopped');
        ctx.check('no error banner', final.errorAlerts.length === 0, final.errorAlerts);
        ctx.check(
            'the answer is marked as stopped by the user',
            /Arrêté par vous/.test(await noticeText(ctx)),
            await noticeText(ctx),
        );
        ctx.check(
            'the answer never arrived',
            !final.messages.some((m) => m.text.includes('MOCK-SLOW-DONE')),
        );
        const closed = await ctx.waitForRequest((r) => r.outcome === 'client-closed', 25_000);
        ctx.check(
            'the HTTP request was closed (or never made)',
            Boolean(closed) || ctx.requests().length === 0,
            ctx.requests().map((r) => r.outcome),
        );
    },
};

const READ_HORIZONTAL_OVERFLOW = `(() => {
    const list = document.querySelector('.ai-chat__messages');
    return list ? list.scrollWidth - list.clientWidth : -1;
})()`;

const longReference: E2eCase = {
    name: 'long-reference',
    description:
        'A long sermon reference tag wraps inside the bubble instead of scrolling sideways',
    async run(ctx) {
        const final = await sendAndCapture(
            ctx,
            'Cite un long titre #scenario:long-reference',
            null,
        );
        await ctx.shot('done');
        checkCleanEnd(ctx, final, 'MOCK-LONG-REFERENCE-DONE');
        const quotedTags = await ctx.page.evaluate<number>(
            `document.querySelectorAll('.ai-chat__bubble blockquote [data-href]').length`,
        );
        ctx.check('the long reference tag sits inside a quote', quotedTags > 0, quotedTags);
        for (const [width, height] of [
            [1440, 900],
            [1024, 768],
            [760, 640],
        ]) {
            await ctx.page.setViewport(width, height);
            await new Promise((resolve) => setTimeout(resolve, 300));
            const overflow = await ctx.page.evaluate<number>(READ_HORIZONTAL_OVERFLOW);
            ctx.check(`no sideways scroll in the thread at ${width}px`, overflow <= 0, overflow);
            await ctx.page.evaluate(
                `document.querySelector('.ai-chat__bubble blockquote').scrollIntoView({ block: 'center' })`,
            );
            await ctx.shot(`quote-${width}`);
        }
        await ctx.page.resetViewport();
    },
};

const BANNER_LANGUAGES = [
    { code: 'en', cut: /Answer cut off/, stopped: /Stopped by you/ },
    { code: 'es', cut: /Respuesta cortada/, stopped: /Detenido por ti/ },
    { code: 'pt', cut: /Resposta cortada/, stopped: /Interrompido por você/ },
    { code: 'sw', cut: /Jibu limekatika/, stopped: /Imesimamishwa na wewe/ },
] as const;

const bannerLanguages: E2eCase = {
    name: 'banner-languages',
    description: 'Outcome banners in en, es, pt and sw, then a small window in fr',
    async run(ctx) {
        try {
            for (const language of BANNER_LANGUAGES) {
                await ctx.page.setUiLanguage(language.code);
                await sendAndCapture(ctx, `Cut ${language.code} #scenario:length-always`, null);
                ctx.check(
                    `the cut banner is in ${language.code}`,
                    language.cut.test(await noticeText(ctx)),
                    await noticeText(ctx),
                );
                await ctx.shot(`truncated-${language.code}`);
                await ctx.page.send(
                    `Stop ${language.code} #scenario:slow-first-token #delay=20000`,
                );
                await ctx.waitUntil((f) => f.spinner, 'waiting indicator');
                await ctx.page.clickStop();
                await ctx.waitForRunEnd(15_000);
                ctx.check(
                    `the stopped banner is in ${language.code}`,
                    language.stopped.test(await noticeText(ctx)),
                    await noticeText(ctx),
                );
                await sendAndCapture(ctx, `Key ${language.code} #scenario:401`, null);
                await ctx.shot(`error-${language.code}`);
            }
        } finally {
            await ctx.page.setUiLanguage('fr');
        }
        await ctx.page.setViewport(760, 640);
        await sendAndCapture(ctx, 'Petite fenêtre #scenario:401', null);
        await ctx.shot('error-small-window');
        await ctx.page.resetViewport();
    },
};

const chatUiCases: E2eCase[] = [
    switchMidRun,
    continueAfterCut,
    retryAfterDrop,
    stopAtOnce,
    longReference,
    bannerLanguages,
];

export const cases: E2eCase[] = [
    normal,
    longResearch,
    reasoningHeavy,
    length,
    lengthAlways,
    lengthEmpty,
    researchOverflow,
    stepLimit,
    bible,
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
    ...chatUiCases,
    ...lifecycleCases,
    // Last: its conversation stays empty, so "new conversation" would reuse it.
    tooLongMessage,
];

const isSubAgentStep = (tag: string) => tag.startsWith('›');

const subagentStepLimit: E2eCase = {
    name: 'subagent-step-limit',
    description: 'A sub-agent that never stops searching still hands back its report',
    async run(ctx) {
        const final = await sendAndCapture(ctx, 'Étude sans fin #scenario:subagent-step-limit', {
            state: 'subagent-running',
            when: (f) => f.toolTags.some(isSubAgentStep),
        });
        await ctx.shot('done');
        checkCleanEnd(ctx, final, 'MOCK-SUBAGENT-STEP-LIMIT-DONE');
        const worker = ctx.requests().filter((r) => r.scenario === 'step-limit-worker');
        ctx.check(
            'the sub-agent stopped at its 50-step limit',
            worker.length === 50,
            worker.length,
        );
        ctx.check(
            'its last step had the tools closed',
            worker[worker.length - 1]?.toolChoice === 'none',
            worker.map((r) => r.toolChoice).slice(-2),
        );
        const answer = lastAssistantText(final);
        ctx.check('the report reached the final answer', answer.includes('Report received: yes'), {
            answer: answer.slice(0, 200),
        });
        ctx.check(
            'the tool result says the research is incomplete (step limit)',
            answer.includes('Sub-agent status: incomplete (step-limit)'),
            answer.slice(0, 200),
        );
        ctx.check(
            'the app did not log "output truncated"',
            !/agent output truncated/i.test(ctx.mainLog()),
        );
    },
};

const subagentStop: E2eCase = {
    name: 'subagent-stop',
    description: 'Stop pressed while the sub-agent is researching',
    async run(ctx) {
        const workerRequests = () => ctx.requests().filter((r) => r.scenario === 'slow-worker');
        await ctx.page.send('Étude lente #scenario:subagent-stop');
        await ctx.waitUntil((f) => f.toolTags.some(isSubAgentStep), 'a sub-agent step', 30_000);
        await ctx.shot('subagent-running');
        const stoppedAt = Date.now();
        await ctx.page.clickStop();
        const final = await ctx.waitForRunEnd(15_000);
        const stopMs = Date.now() - stoppedAt;
        await ctx.shot('stopped');
        await new Promise((resolve) => setTimeout(resolve, 4_000));
        const startedAfterStop = workerRequests().filter((r) => Date.parse(r.at) > stoppedAt);
        ctx.check('the run ended within 3 s of Stop', stopMs < 3_000, stopMs);
        ctx.check(
            'the sub-agent started no model call after Stop',
            startedAfterStop.length === 0,
            startedAfterStop.map((r) => r.at),
        );
        ctx.check(
            'the sub-agent did not report back after Stop',
            !/Sub-agent finished/.test(ctx.mainLog().split('Sub-agent starting').pop() ?? ''),
        );
        ctx.check(
            'the main model did not answer after Stop',
            !lastAssistantText(final).includes('MOCK-SUBAGENT-STOP-SHOULD-NOT-APPEAR'),
        );
        ctx.check('no error banner', final.errorAlerts.length === 0, final.errorAlerts);
    },
};

cases.splice(cases.length - 1, 0, subagentStepLimit, subagentStop);
