import {
    complete,
    drop,
    httpError,
    pause,
    reasoning,
    sequence,
    text,
    toolCall,
    words,
    type Reply,
    type Scenario,
    type ScenarioContext,
} from './scenario';

interface FoundSermon {
    sermonId: string;
    translationId?: number;
    title?: string;
}

function parseJson(content: string): unknown {
    try {
        return JSON.parse(content);
    } catch {
        return null;
    }
}

function latestResultsOf(ctx: ScenarioContext, toolName: string): unknown[] {
    return ctx.toolResults
        .filter((result) => result.toolName === toolName)
        .reverse()
        .map((result) => parseJson(result.content));
}

function lastFoundSermon(ctx: ScenarioContext): FoundSermon | null {
    for (const parsed of latestResultsOf(ctx, 'searchSermons')) {
        const sermon = (parsed as { results?: FoundSermon[] } | null)?.results?.[0];
        if (sermon?.sermonId) return sermon;
    }
    return null;
}

/** A word that really occurs in the installed language, so a content search finds hits. */
function wordFromLastSermonText(ctx: ScenarioContext): string | null {
    for (const parsed of latestResultsOf(ctx, 'getSermonContent')) {
        const paragraphs = (parsed as { paragraphs?: { text?: string }[] } | null)?.paragraphs;
        const candidates = (paragraphs ?? [])
            .flatMap((paragraph) => (paragraph.text ?? '').split(/[^\p{L}]+/u))
            .filter((word) => word.length >= 6);
        if (candidates.length > 0) return candidates[Math.floor(candidates.length / 2)];
    }
    return null;
}

function readSermonFoundBySearch(ctx: ScenarioContext, year: number, maxParagraphs = 3): Reply {
    const sermon = lastFoundSermon(ctx);
    if (!sermon) return complete([toolCall('searchSermons', { query: String(year), limit: 3 })]);
    return complete([
        toolCall('getSermonContent', {
            sermonId: sermon.sermonId,
            translationId: sermon.translationId,
            maxParagraphs,
        }),
    ]);
}

const toolsClosed = (ctx: ScenarioContext) => ctx.request.tool_choice === 'none';

export const LONG_RESEARCH_TOOL_STEPS = 32;
/** Keeps the run long enough (about 5 s) to watch and screenshot the tool steps. */
const TOOL_STEP_THINKING_MS = 300;
const RESEARCH_YEARS = Array.from({ length: 16 }, (_, i) => 1950 + i);

function longResearchStep(ctx: ScenarioContext): Reply {
    const index = ctx.stepIndex;
    if (index >= LONG_RESEARCH_TOOL_STEPS) {
        return complete([
            reasoning('I have read enough sermons to answer.'),
            text(
                `## Research summary\n\nI searched ${RESEARCH_YEARS.length} years and read ` +
                    `${RESEARCH_YEARS.length} sermons.\n\n- First point\n- Second point\n\n` +
                    `${words(80)}\n\nMOCK-LONG-RESEARCH-DONE`,
                3,
            ),
        ]);
    }
    if (index === LONG_RESEARCH_TOOL_STEPS - 1) {
        const word = wordFromLastSermonText(ctx) ?? 'faith';
        return complete([
            pause(TOOL_STEP_THINKING_MS),
            toolCall('searchContent', { query: word, limit: 5 }),
        ]);
    }
    const year = RESEARCH_YEARS[Math.floor(index / 2)];
    if (index % 2 === 1) return readSermonFoundBySearch(ctx, year);
    return complete([
        pause(TOOL_STEP_THINKING_MS),
        reasoning(`Step ${index + 1}: searching sermons from ${year}.`),
        toolCall('searchSermons', { query: String(year), limit: 3 }),
    ]);
}

export const OVERFLOW_TOOL_STEPS = 41;

/** One search, then the same 50 paragraphs read again and again: the results outgrow the
 * 128k window unless the app condenses them. */
function researchOverflowStep(ctx: ScenarioContext): Reply {
    if (ctx.stepIndex >= OVERFLOW_TOOL_STEPS || toolsClosed(ctx)) {
        const condensed = ctx.toolResults.filter((r) =>
            r.content.startsWith('[Condensed earlier result]'),
        ).length;
        return complete([
            reasoning('Enough material. Writing.'),
            text(
                `## Overflow research\n\nI read ${ctx.toolResults.length} results ` +
                    `(${condensed} condensed).\n\n${words(60)}\n\nMOCK-OVERFLOW-DONE`,
                4,
            ),
        ]);
    }
    return readSermonFoundBySearch(ctx, 1963, 50);
}

interface FoundVerse {
    bookCode?: string;
    bookName?: string;
    chapter?: string | number;
    verse?: string | number;
}

function firstVerseOf(ctx: ScenarioContext, toolName: string): FoundVerse | null {
    for (const parsed of latestResultsOf(ctx, toolName)) {
        const record = parsed as { results?: FoundVerse[]; verses?: FoundVerse[] } | null;
        const verse = record?.results?.[0] ?? record?.verses?.[0];
        if (verse?.bookCode) return verse;
    }
    return null;
}

const utilityScenarios: Scenario[] = [
    {
        name: 'title',
        description: 'Conversation title generation',
        matches: (ctx) => ctx.userText.startsWith('Generate a short conversation title'),
        reply: () => complete([text('Mock conversation title')]),
    },
    {
        name: 'probe',
        description: 'Provider test from the settings',
        matches: (ctx) => ctx.userText.startsWith('Reply with the single word OK'),
        reply: () => complete([text('OK')]),
    },
    {
        name: 'echo',
        description: 'Default when no tag is given: one short answer',
        reply: () => complete([text('This is the mock reply. MOCK-ECHO-DONE')]),
    },
];

const answerScenarios: Scenario[] = [
    {
        name: 'normal',
        description: 'One sermon search, then a markdown answer',
        reply: sequence(
            () =>
                complete([
                    reasoning('The user asks about sermons. I will search the 1963 sermons.'),
                    toolCall('searchSermons', { query: '1963', limit: 3 }),
                ]),
            (ctx) => {
                const sermon = lastFoundSermon(ctx);
                const found = sermon ? `**${sermon.title}** (${sermon.sermonId})` : 'no sermon';
                return complete(
                    [
                        text(
                            `## Answer\n\nI found ${found}.\n\n1. First point\n2. Second point\n\n` +
                                `${words(40)}\n\nMOCK-NORMAL-DONE`,
                            2,
                        ),
                    ],
                    { chunkDelayMs: 60, usage: { prompt: 4000, completion: 120 } },
                );
            },
        ),
    },
    {
        name: 'long-research',
        description: `${LONG_RESEARCH_TOOL_STEPS} tool-call steps over real sermon tools, then an answer`,
        reply: longResearchStep,
    },
    {
        name: 'reasoning-heavy',
        description: 'Long reasoning before and after a tool call, short answer',
        reply: sequence(
            () =>
                complete(
                    [
                        reasoning(`Thinking hard. ${words(600)}`, 6),
                        toolCall('searchSermons', { query: '1965', limit: 2 }),
                    ],
                    { chunkDelayMs: 20, usage: { prompt: 3000, completion: 900, reasoning: 850 } },
                ),
            () =>
                complete(
                    [
                        reasoning(`Still thinking. ${words(300)}`, 6),
                        text('Short answer after long thought. MOCK-REASONING-DONE'),
                    ],
                    { chunkDelayMs: 20, usage: { prompt: 3500, completion: 500, reasoning: 480 } },
                ),
        ),
    },
    {
        name: 'slow-stream',
        description: 'A tool call, then a long answer streamed slowly (for Stop tests)',
        reply: sequence(
            () => complete([toolCall('searchSermons', { query: '1960', limit: 2 })]),
            () =>
                complete([text(`## Slow answer\n\n${words(400)}\n\nMOCK-SLOW-STREAM-DONE`, 2)], {
                    chunkDelayMs: 120,
                }),
        ),
    },
    {
        name: 'subagent',
        description: 'Delegates to the researchTopic sub-agent, then answers',
        reply: sequence(
            () =>
                complete([
                    reasoning('This is broad research, so I delegate it.'),
                    toolCall('researchTopic', {
                        topic: 'Sermons preached in 1963 #scenario:research-worker',
                    }),
                ]),
            (ctx) => {
                const reported = ctx.toolResults.some((r) => r.toolName === 'researchTopic');
                const summary = reported ? 'The research agent reported back.' : 'No report.';
                return complete([
                    text(`## From the research agent\n\n${summary}\n\nMOCK-SUBAGENT-DONE`),
                ]);
            },
        ),
    },
    {
        name: 'unsafe-links',
        description:
            'An answer with in-app, web, mail, relative, file and script links and a remote image',
        reply: () =>
            complete([
                text(
                    [
                        '## Links',
                        '',
                        '- In-app: [Sermon 63-0318](wmb://sermon/63-0318/tur/1/1)',
                        '- Web: [Docs](https://wmb-table.web.app/)',
                        '- Mail: [Contact](mailto:contact@example.com)',
                        '- Relative: [RELATIVE-LINK](../../../../../../etc/passwd)',
                        '- File: [FILE-LINK](file:///etc/passwd)',
                        '- Script: [SCRIPT-LINK](javascript:alert(document.title))',
                        '',
                        '![IMAGE-ALT](https://leak.example.invalid/pixel.png?notes=secret)',
                        '',
                        'MOCK-LINKS-DONE',
                    ].join('\n'),
                ),
            ]),
    },
    {
        name: 'research-overflow',
        description: `${OVERFLOW_TOOL_STEPS} steps reading 50 paragraphs each, more than the window holds`,
        reply: researchOverflowStep,
    },
    {
        name: 'step-limit',
        description: 'Calls a tool on every step until the app closes the tools, then answers',
        reply: (ctx) =>
            toolsClosed(ctx)
                ? complete([text(`## Final answer\n\n${words(40)}\n\nMOCK-STEP-LIMIT-DONE`, 4)])
                : complete([
                      toolCall('searchSermons', {
                          query: String(1950 + (ctx.stepIndex % 15)),
                          limit: 1,
                      }),
                  ]),
    },
    {
        name: 'bible',
        description:
            'A Bible search, then the passage around the first hit, then an answer citing it',
        reply: sequence(
            () =>
                complete([
                    reasoning('The user asks about a Bible verse.'),
                    toolCall('searchBible', {
                        query: 'naked',
                        bibleVersionAbbreviation: 'kjv',
                        limit: 3,
                    }),
                ]),
            (ctx) => {
                const hit = firstVerseOf(ctx, 'searchBible');
                if (!hit) return complete([text('No Bible hit. MOCK-BIBLE-NO-HIT')]);
                return complete([
                    toolCall('getBiblePassage', {
                        bookCode: hit.bookCode,
                        chapter: String(hit.chapter),
                        fromVerse: String(hit.verse),
                        toVerse: String(Number(hit.verse) + 2),
                        bibleVersionAbbreviation: 'kjv',
                    }),
                ]);
            },
            (ctx) => {
                const verse = firstVerseOf(ctx, 'getBiblePassage');
                const reference = verse
                    ? `${verse.bookName} ${verse.chapter}:${verse.verse}`
                    : 'none';
                return complete([
                    text(`## Bible\n\nPassage read: ${reference}.\n\nMOCK-BIBLE-DONE`),
                ]);
            },
        ),
    },
    {
        name: 'research-worker',
        description: 'Inner steps of the research sub-agent (started by the subagent scenario)',
        reply: sequence(
            () => complete([toolCall('searchSermons', { query: '1963', limit: 3 })]),
            (ctx) => readSermonFoundBySearch(ctx, 1963),
            () =>
                complete([
                    text('Research report: the 1963 sermons were searched and one was read.'),
                ]),
        ),
    },
];

const failureScenarios: Scenario[] = [
    {
        name: 'length',
        description: 'Answer cut by finish_reason "length", then finished by the continuation',
        reply: sequence(
            () =>
                complete([text(`## Partial answer\n\n${words(120)} MOCK-LENGTH-TEXT`, 4)], {
                    finishReason: 'length',
                    usage: { prompt: 2000, completion: 16_384 },
                }),
            () => complete([text(` and the rest of the answer. MOCK-LENGTH-DONE`, 3)]),
        ),
    },
    {
        name: 'length-always',
        description: 'Every reply, continuations included, ends with finish_reason "length"',
        reply: (ctx) =>
            complete([text(` part ${ctx.stepIndex + 1}: ${words(40)} MOCK-LENGTH-PART`, 4)], {
                finishReason: 'length',
                usage: { prompt: 2000, completion: 16_384 },
            }),
    },
    {
        name: 'length-empty',
        description:
            'Only reasoning, then "length" with no text; the answer comes on the next call',
        reply: sequence(
            () =>
                complete([reasoning(`Reasoning that uses the whole budget. ${words(200)}`, 8)], {
                    finishReason: 'length',
                    usage: { prompt: 2000, completion: 16_384, reasoning: 16_384 },
                }),
            () =>
                complete([
                    text(
                        `## Answer\n\nThe answer written after the long reasoning. MOCK-LENGTH-EMPTY-DONE`,
                        3,
                    ),
                ]),
        ),
    },
    {
        name: '401',
        description: 'HTTP 401 invalid API key',
        reply: () =>
            httpError(
                401,
                'Incorrect API key provided. You can find your API key in your account settings.',
                'invalid_request_error',
                'invalid_api_key',
            ),
    },
    {
        name: '404',
        description: 'HTTP 404 model not found',
        reply: (ctx) =>
            httpError(
                404,
                `The model \`${ctx.request.model}\` does not exist or you do not have access to it.`,
                'invalid_request_error',
                'model_not_found',
            ),
    },
    {
        name: '500',
        description: 'HTTP 500 on every call (the app retries)',
        reply: () =>
            httpError(
                500,
                'The server had an error while processing your request.',
                'server_error',
            ),
    },
    {
        name: 'drop',
        description: 'Connection closed mid-stream after some text, no finish reason',
        reply: () =>
            complete(
                [text(`Starting the answer. ${words(30)} MOCK-DROP-TEXT`, 3), pause(200), drop()],
                {
                    chunkDelayMs: 20,
                },
            ),
    },
    {
        name: 'slow-first-token',
        description: 'Waits before the first token (#delay=<ms>, default 15000)',
        reply: (ctx) =>
            complete([
                pause(Number(ctx.params.delay ?? 15_000)),
                text('Finally, the first token. MOCK-SLOW-DONE'),
            ]),
    },
];

export const scenarios: Scenario[] = [...utilityScenarios, ...answerScenarios, ...failureScenarios];

export const DEFAULT_SCENARIO = 'echo';
