import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { CaseContext, type CaseResult, type E2eCase } from './case-runner';
import { cases } from './cases';
import { AppProcess } from './driver/app-process';
import { setUpApp } from './driver/app-setup';
import type { CdpSession } from './driver/cdp';
import { ChatPage } from './driver/chat-page';
import { MOCK_MODEL_ID } from './mock-llm/scenario';
import { startMockLlmServer, type MockLlmServer } from './mock-llm/server';

const repoRoot = resolve(import.meta.dirname, '../..');

const USAGE = `Usage: pnpm test:e2e [-- options]
  --scenario <name>   run only these cases (repeat or comma-separate)
  --repeat <n>        run the selected cases n times in one app session (default 1)
  --out <dir>         output folder (default tmp/e2e-output/<time>)
  --cache-dir <dir>   language pack cache (default tmp/e2e-cache)
  --list              list the cases and exit`;

interface RunOptions {
    selected: E2eCase[];
    repeat: number;
    outDir: string;
    cacheDir: string;
}

function parseOptions(): RunOptions | null {
    const { values } = parseArgs({
        args: process.argv.slice(2).filter((arg) => arg !== '--'),
        options: {
            scenario: { type: 'string', multiple: true },
            repeat: { type: 'string', default: '1' },
            out: { type: 'string' },
            'cache-dir': { type: 'string' },
            list: { type: 'boolean', default: false },
            help: { type: 'boolean', default: false },
        },
    });
    if (values.help || values.list) {
        console.log(
            values.list
                ? cases.map((c) => `${c.name.padEnd(26)}${c.description}`).join('\n')
                : USAGE,
        );
        return null;
    }
    const names = (values.scenario ?? []).flatMap((value) => value.split(','));
    const unknown = names.filter((name) => !cases.some((c) => c.name === name));
    if (unknown.length > 0) throw new Error(`Unknown case(s): ${unknown.join(', ')}\n${USAGE}`);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
        selected: names.length > 0 ? cases.filter((c) => names.includes(c.name)) : cases,
        repeat: Math.max(1, Number(values.repeat)),
        outDir: resolve(values.out ?? join(repoRoot, 'tmp/e2e-output', stamp)),
        cacheDir: resolve(values['cache-dir'] ?? join(repoRoot, 'tmp/e2e-cache')),
    };
}

async function runCase(
    testCase: E2eCase,
    page: ChatPage,
    server: MockLlmServer,
    app: AppProcess,
    label: string,
): Promise<CaseResult> {
    const ctx = new CaseContext(label, page, server, () => app.mainLog());
    const startedAt = Date.now();
    let error: string | undefined;
    try {
        await page.startNewConversation();
        await testCase.run(ctx);
    } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
        await page.stopIfRunning();
    }
    return {
        name: label,
        durationMs: Date.now() - startedAt,
        checks: ctx.checks,
        screenshots: ctx.screenshots,
        error,
        finalFacts: await page.facts().catch(() => undefined),
    };
}

function caseFailed(result: CaseResult): boolean {
    return Boolean(result.error) || result.checks.some((check) => check.status === 'fail');
}

const STATUS_MARK = { pass: 'ok  ', fail: 'FAIL', 'known-bug': 'BUG ', 'bug-fixed': 'FIX?' };

function printSummary(results: CaseResult[], outDir: string): void {
    for (const result of results) {
        const verdict = caseFailed(result) ? 'FAIL' : 'PASS';
        console.log(`\n${verdict} ${result.name} (${(result.durationMs / 1000).toFixed(1)} s)`);
        if (result.error) console.log(`  error: ${result.error}`);
        for (const check of result.checks) {
            const bug = check.knownBug ? `  [known bug: ${check.knownBug}]` : '';
            const details = check.status === 'pass' ? '' : `  ${check.details ?? ''}`;
            console.log(`  ${STATUS_MARK[check.status]} ${check.label}${bug}${details}`);
        }
    }
    const failed = results.filter(caseFailed).length;
    const knownBugs = results
        .flatMap((r) => r.checks)
        .filter((c) => c.status === 'known-bug').length;
    const fixed = results.flatMap((r) => r.checks).filter((c) => c.status === 'bug-fixed').length;
    console.log(
        `\n${results.length - failed}/${results.length} cases passed, ${knownBugs} known-bug checks still failing` +
            `${fixed ? `, ${fixed} known-bug checks now pass (remove their knownBug marker)` : ''}`,
    );
    console.log(`Output: ${outDir}`);
}

function writeArtifacts(
    outDir: string,
    results: CaseResult[],
    cdp: CdpSession | null,
    app: AppProcess,
): void {
    writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2));
    writeFileSync(
        join(outDir, 'renderer-console-errors.json'),
        JSON.stringify(cdp?.consoleErrors ?? [], null, 2),
    );
    writeFileSync(join(outDir, 'main.log'), app.mainLog());
}

async function run(options: RunOptions): Promise<boolean> {
    mkdirSync(options.outDir, { recursive: true });
    const server = await startMockLlmServer({
        logFile: join(options.outDir, 'llm-requests.jsonl'),
    });
    const app = new AppProcess({ repoRoot, profileParent: join(repoRoot, 'tmp/e2e-profiles') });
    const stopAll = async () => {
        await app.stop();
        await server.close();
    };
    process.once('SIGINT', () => void stopAll().then(() => process.exit(130)));
    process.once('SIGTERM', () => void stopAll().then(() => process.exit(143)));

    let cdp: CdpSession | null = null;
    const results: CaseResult[] = [];
    try {
        cdp = await app.start();
        const setup = await setUpApp(cdp, app, {
            repoRoot,
            cacheDir: options.cacheDir,
            mockBaseUrl: server.baseUrl,
            mockModelId: MOCK_MODEL_ID,
        });
        console.log(`Mock LLM at ${server.baseUrl}, sermon language "${setup.languageCode}"`);
        const page = new ChatPage(cdp, join(options.outDir, 'screens'));
        await page.open();
        await page.screenshotBothThemes('empty-chat');
        for (let round = 1; round <= options.repeat; round++) {
            for (const testCase of options.selected) {
                const label = options.repeat > 1 ? `${testCase.name}-run${round}` : testCase.name;
                console.log(`running ${label}...`);
                results.push(await runCase(testCase, page, server, app, label));
            }
        }
    } finally {
        writeArtifacts(options.outDir, results, cdp, app);
        cdp?.close();
        await stopAll();
    }
    printSummary(results, options.outDir);
    return results.length > 0 && !results.some(caseFailed);
}

const options = parseOptions();
if (options) {
    run(options)
        .then((passed) => process.exit(passed ? 0 : 1))
        .catch((error: unknown) => {
            console.error(error);
            process.exit(1);
        });
}
