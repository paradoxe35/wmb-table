import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { AppProcess } from './driver/app-process';
import { setUpApp } from './driver/app-setup';
import type { CdpSession } from './driver/cdp';
import { ChatPage } from './driver/chat-page';
import { MOCK_MODEL_ID } from './mock-llm/scenario';
import { startMockLlmServer } from './mock-llm/server';

/**
 * Live check of follow reading with a real voice: while the document is read aloud, the highlighted
 * sentence must stay inside the visible area. Uses the offline Sherpa voice (downloaded once into
 * the cache folder); `--voice edge` uses Edge TTS, which rate-limits repeated runs.
 * Not part of `pnpm test:e2e`. Run after `pnpm build`:
 * node --import ./scripts/ts-aliases.mjs tests/e2e/follow-reading-run.ts [--sentences 12]
 */

const repoRoot = resolve(import.meta.dirname, '../..');
const DOCUMENT_TITLE = 'Lecture suivie';
const SCROLLER = `document.getElementById('page-container')`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SENTENCES = [
    'Au commencement était la Parole, et la Parole était avec Dieu.',
    'Elle était au commencement avec Dieu, et toutes choses ont été faites par elle.',
    'En elle était la vie, et la vie était la lumière des hommes.',
    'La lumière luit dans les ténèbres, et les ténèbres ne l’ont point reçue.',
    'Il y eut un homme envoyé de Dieu, son nom était Jean.',
    'Il vint pour servir de témoin, pour rendre témoignage à la lumière.',
    'Il n’était pas la lumière, mais il parut pour rendre témoignage à la lumière.',
    'Cette lumière était la véritable lumière, qui, en venant dans le monde, éclaire tout homme.',
    'Elle était dans le monde, et le monde a été fait par elle.',
    'Elle est venue chez les siens, et les siens ne l’ont point reçue.',
    'Mais à tous ceux qui l’ont reçue, elle a donné le pouvoir de devenir enfants de Dieu.',
    'Et la Parole a été faite chair, et elle a habité parmi nous, pleine de grâce et de vérité.',
];

function documentText(): string {
    // Long enough to be taller than a small window, short enough for Edge's request limit
    const longParagraph = [...SENTENCES, ...SENTENCES.slice(0, 6)].join(' ');
    const longSentence = `${Array.from(
        { length: 22 },
        (_, i) => `la lumière qui éclaire le chemin numéro ${i + 1}`,
    ).join(', ')}.`;
    return [
        'Un court paragraphe pour commencer.',
        longParagraph,
        'Un autre court paragraphe.',
        longSentence.charAt(0).toUpperCase() + longSentence.slice(1),
        'Fin de la lecture.',
        ...Array.from(
            { length: 30 },
            (_, i) =>
                `Paragraphe ${i + 1} pour allonger le document : ${SENTENCES[i % SENTENCES.length]}`,
        ),
    ].join('\n\n');
}

interface Sample {
    at: number;
    paragraph: number | null;
    text: string;
    visible: boolean;
    top: number;
    bottom: number;
    viewTop: number;
    viewBottom: number;
}

const READ_SAMPLE = `(() => {
    const scroller = ${SCROLLER};
    const marks = [...document.querySelectorAll('.tts-active-sentence')];
    if (!scroller || marks.length === 0) return null;
    const view = scroller.getBoundingClientRect();
    const viewBottom = view.top + scroller.clientHeight;
    const rects = marks.map((m) => m.getBoundingClientRect());
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    const tall = bottom - top > scroller.clientHeight;
    const visible = tall
        ? top >= view.top - 1 && top < viewBottom
        : top >= view.top - 1 && bottom <= viewBottom + 1;
    const paragraph = marks[0].closest('[data-paragraph-index]');
    return {
        paragraph: paragraph ? Number(paragraph.dataset.paragraphIndex) : null,
        text: marks.map((m) => m.textContent).join('').slice(0, 40),
        visible, top, bottom, viewTop: view.top, viewBottom,
    };
})()`;

class FollowReadingRun {
    readonly results: { label: string; passed: boolean; details?: unknown }[] = [];

    private readonly cdp: CdpSession;
    private readonly outDir: string;

    constructor(cdp: CdpSession, outDir: string) {
        this.cdp = cdp;
        this.outDir = outDir;
    }

    check(label: string, passed: boolean, details?: unknown): void {
        this.results.push({ label, passed, details: passed ? undefined : details });
        console.log(
            `  ${passed ? 'ok  ' : 'FAIL'} ${label}${passed ? '' : ` ${JSON.stringify(details)}`}`,
        );
    }

    async shot(name: string): Promise<void> {
        mkdirSync(join(this.outDir, 'screens'), { recursive: true });
        writeFileSync(join(this.outDir, 'screens', `${name}.png`), await this.cdp.screenshot());
    }

    async setViewport(width: number, height: number): Promise<void> {
        await this.cdp.send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await sleep(300);
    }

    /** Downloads the smallest French Sherpa voice once and keeps it in the cache folder. */
    async installSherpaVoice(appDataDir: string, cacheDir: string): Promise<void> {
        const cachedModels = join(cacheDir, 'tts-models');
        const appModels = join(appDataDir, 'tts-models');
        if (existsSync(cachedModels)) cpSync(cachedModels, appModels, { recursive: true });
        const modelName = await this.cdp.evaluate<string>(
            `(async () => {
                const models = await window.api.tts.getProviderModels('sherpa');
                const [smallest] = models
                    .filter((m) => m.langCode.includes('fr'))
                    .sort((a, b) => (a.filesizeMb ?? 1e9) - (b.filesizeMb ?? 1e9));
                if (!smallest.installed) await window.api.tts.downloadModel('sherpa', smallest.modelName);
                return smallest.modelName;
            })()`,
            600_000,
        );
        cpSync(appModels, cachedModels, { recursive: true });
        console.log(`Sherpa voice: ${modelName}`);
    }

    async prepare(voice: string): Promise<void> {
        await this.cdp.evaluate(`(async () => {
            const bytes = new TextEncoder().encode(${JSON.stringify(documentText())});
            await window.api.app.createCustomDocument(${JSON.stringify(DOCUMENT_TITLE)}, { fileName: 'lecture.txt', mimeType: 'text/plain', bytes }, 'fr');
            await window.api.tts.updateSettings({
                activeProvider: '${voice}',
                highlightMode: 'sentence',
                autoScrollToHighlight: true,
                readIntroduction: false,
                announceSegmentNumbers: false,
                rate: 1.6,
            });
        })()`);
        await this.cdp.reload();
        await this.cdp.waitFor(
            `[...document.querySelectorAll('.layout__sidebar .tab')].some((t) => t.innerText.includes('Documents'))`,
            'documents tab',
        );
        await this.cdp.evaluate(
            `[...document.querySelectorAll('.layout__sidebar .tab')].find((t) => t.innerText.includes('Documents')).click()`,
        );
        await this.cdp.waitFor(
            `[...document.querySelectorAll('.sidebar-item')].some((el) => el.innerText.includes(${JSON.stringify(DOCUMENT_TITLE)}))`,
            'custom document in the list',
        );
        await new ChatPage(this.cdp, this.outDir).clickElement(
            `[...document.querySelectorAll('.sidebar-item')].find((el) => el.innerText.includes(${JSON.stringify(DOCUMENT_TITLE)}))`,
            'the custom document',
        );
        await sleep(1500);
        await this.shot('opened');
        await this.cdp.waitFor(
            `(document.getElementById('page-container')?.innerText ?? '').includes('Un court paragraphe pour commencer')`,
            'the custom document',
        );
    }

    async play(): Promise<void> {
        await this.cdp.evaluate(`${SCROLLER}.scrollTop = 0`);
        await this.cdp.waitFor(
            `Boolean([...document.querySelectorAll('button[aria-label]')].find((b) => b.getAttribute('aria-label') === 'Lire à voix haute' && !b.disabled))`,
            'read aloud button',
        );
        await this.cdp.evaluate(
            `[...document.querySelectorAll('button[aria-label]')].find((b) => b.getAttribute('aria-label') === 'Lire à voix haute').click()`,
        );
        await this.cdp.waitFor(
            `Boolean(document.querySelector('.tts-active-sentence'))`,
            'first highlight',
            60_000,
        );
    }

    async stop(): Promise<void> {
        await this.cdp.evaluate(`window.api.tts.stop?.()`).catch(() => undefined);
        const pause = `[...document.querySelectorAll('button[aria-label]')].find((b) => b.getAttribute('aria-label') === 'Lire à voix haute' && b.querySelector('.anticon-pause'))`;
        await this.cdp.evaluate(`${pause}?.click()`);
        await sleep(500);
    }

    async topButton(label: string): Promise<void> {
        const scroller = SCROLLER;
        const button = `document.querySelector('.document-top-button')`;
        const isShown = `${button}.classList.contains('document-top-button--visible') && getComputedStyle(${button}).visibility === 'visible'`;
        await this.cdp.evaluate(`${scroller}.scrollTop = ${scroller}.scrollHeight`);
        await sleep(600);
        this.check(
            `${label}: the button shows at the end of the document`,
            await this.cdp.evaluate<boolean>(isShown),
        );
        const overlaps = await this.cdp.evaluate<string[]>(`(() => {
            const b = ${button}.getBoundingClientRect();
            const hits = [];
            for (const content of document.querySelectorAll('#page-container .paragraph-content')) {
                const range = document.createRange();
                range.selectNodeContents(content);
                for (const r of range.getClientRects()) {
                    if (r.width && r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom) {
                        hits.push(content.textContent.slice(0, 30));
                    }
                }
            }
            return hits;
        })()`);
        this.check(
            `${label}: no text is under the button at the end`,
            overlaps.length === 0,
            overlaps,
        );
        await this.shot(`top-button-end-${label}`);

        await new ChatPage(this.cdp, this.outDir).clickElement(
            `${button}.querySelector('button')`,
            'the back-to-start button',
        );
        await sleep(1500);
        const top = await this.cdp.evaluate<number>(`${scroller}.scrollTop`);
        this.check(`${label}: one click goes back to the start`, top === 0, top);
        this.check(
            `${label}: the button hides at the start`,
            !(await this.cdp.evaluate<boolean>(isShown)),
        );

        await this.cdp.evaluate(`${scroller}.scrollTop = ${scroller}.scrollHeight * 0.3`);
        await sleep(200);
        await this.cdp.evaluate(`${scroller}.scrollTop = ${scroller}.scrollHeight * 0.45`);
        await sleep(400);
        this.check(
            `${label}: hidden while reading down the middle`,
            !(await this.cdp.evaluate<boolean>(isShown)),
        );
        await this.cdp.send('Input.dispatchMouseEvent', {
            type: 'mouseWheel',
            x: 300,
            y: 300,
            deltaX: 0,
            deltaY: -300,
        });
        await sleep(600);
        this.check(
            `${label}: shows when the reader heads back up`,
            await this.cdp.evaluate<boolean>(isShown),
        );
        await this.shot(`top-button-up-${label}`);
    }

    /** Opens a document from the right panel tab `panel` by the title of its list item. */
    async openFromPanel(panel: string, title: string): Promise<void> {
        await this.cdp.evaluate(
            `[...document.querySelectorAll('.layout__sidebar .tab')].find((t) => t.innerText.includes(${JSON.stringify(panel)})).click()`,
        );
        await this.cdp.waitFor(
            `[...document.querySelectorAll('.sidebar-item')].some((el) => el.innerText.includes(${JSON.stringify(title)}))`,
            `"${title}" in the ${panel} list`,
        );
        const item = `[...document.querySelectorAll('.sidebar-item')].find((el) => el.innerText.includes(${JSON.stringify(title)}))`;
        await this.cdp.evaluate(`${item}.scrollIntoView({ block: 'center' })`);
        await sleep(300);
        await new ChatPage(this.cdp, this.outDir).clickElement(item, `"${title}"`);
    }

    /** Waits for the voice to end on its own, returning how far down the view went meanwhile. */
    async readToTheEnd(until: string, timeoutMs: number): Promise<number> {
        await this.play();
        let deepest = 0;
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            deepest = Math.max(deepest, await this.cdp.evaluate<number>(`${SCROLLER}.scrollTop`));
            if (await this.cdp.evaluate<boolean>(until)) return deepest;
            await sleep(250);
        }
        throw new Error(`Reading did not reach: ${until}`);
    }

    async finishedReading(): Promise<void> {
        const title = 'Lecture courte';
        const text = SENTENCES.slice(0, 10)
            .map((sentence, i) => `${i + 1}. ${sentence}`)
            .join('\n\n');
        const id = await this.cdp.evaluate<string>(`(async () => {
            const bytes = new TextEncoder().encode(${JSON.stringify(text)});
            const doc = await window.api.app.createCustomDocument(${JSON.stringify(title)}, { fileName: 'courte.txt', mimeType: 'text/plain', bytes }, 'fr');
            return doc.id;
        })()`);
        await this.cdp.reload();
        await this.openFromPanel('Documents', title);
        await this.cdp.waitFor(
            `(document.getElementById('page-container')?.innerText ?? '').includes('Au commencement')`,
            'the short document',
        );
        const notReading = `!document.querySelector('.tts-active-sentence') && !document.querySelector('button[aria-label="Lire à voix haute"] .anticon-pause')`;
        const deepest = await this.readToTheEnd(
            `(() => { const ok = ${notReading}; if (!ok) window.__wasReading = true; return ok && window.__wasReading === true; })()`,
            180_000,
        );
        await sleep(1500);
        await this.shot('finished-custom-end');
        const saved = await this.cdp.evaluate<{ scrollY: number } | null>(
            `window.api.documents.getReadingPosition(${JSON.stringify(`custom:${id}`)})`,
        );
        this.check(
            `a document read to its end is saved at its start (view went down to ${Math.round(deepest)} px)`,
            deepest > 0 && saved?.scrollY === 0,
            { deepest, saved },
        );
        await this.openFromPanel('Documents', DOCUMENT_TITLE);
        await sleep(800);
        await this.openFromPanel('Documents', title);
        await sleep(1200);
        const reopenedAt = await this.cdp.evaluate<number>(`${SCROLLER}.scrollTop`);
        this.check('it opens at the start again', reopenedAt === 0, reopenedAt);
        await this.shot('finished-custom-reopened');

        try {
            await this.finishedBibleChapter();
        } catch (error) {
            await this.shot('finished-bible-error');
            throw error;
        }
    }

    async finishedBibleChapter(): Promise<void> {
        const version = await this.cdp.evaluate<{
            abbreviation: string;
            available: boolean;
        } | null>(
            `window.api.bible.getAllVersions().then((all) => all.find((v) => v.langCode === 'fr' && v.available) ?? all.find((v) => v.langCode === 'fr') ?? null)`,
        );
        if (!version) {
            this.check('a French Bible is available for the whole-book check', false, 'none');
            return;
        }
        if (!version.available) {
            await this.cdp.evaluate(
                `window.api.bible.downloadVersion(${JSON.stringify(version.abbreviation)})`,
                600_000,
            );
        }
        await this.cdp.evaluate(`(async () => {
            await window.api.tts.updateSettings({ bibleReadEntireBook: true });
        })()`);
        await this.cdp.reload();
        const openChapter = async (chapter: string) => {
            await this.openFromPanel('Bible', 'Psaumes');
            await this.cdp.waitFor(
                `[...document.querySelectorAll('.layout__sidebar button')].some((b) => b.innerText.trim() === '${chapter}')`,
                `chapter ${chapter} button`,
            );
            const button = `[...document.querySelectorAll('.layout__sidebar button')].find((b) => b.innerText.trim() === '${chapter}')`;
            await this.cdp.evaluate(`${button}.scrollIntoView({ block: 'center' })`);
            await sleep(300);
            await new ChatPage(this.cdp, this.outDir).clickElement(button, `chapter ${chapter}`);
            await this.cdp.waitFor(
                `(document.querySelector('#page-container .sermon-content-header__date')?.innerText ?? '').includes('${chapter}')`,
                `Psalm ${chapter}`,
            );
            await sleep(800);
        };
        await openChapter('121');
        const deepest = await this.readToTheEnd(
            `(document.querySelector('#page-container .sermon-content-header__date')?.innerText ?? '').includes('122') && Boolean(document.querySelector('.tts-active-sentence'))`,
            240_000,
        );
        await this.shot('finished-bible-next-chapter');
        await this.stop();
        this.check(
            `whole-book reading moved on from Psalm 121 to 122 (view went down to ${Math.round(deepest)} px in 121)`,
            deepest > 0,
            deepest,
        );
        await openChapter('121');
        const reopenedAt = await this.cdp.evaluate<number>(`${SCROLLER}.scrollTop`);
        this.check(
            'Psalm 121, read to its end, opens at its start again',
            reopenedAt === 0,
            reopenedAt,
        );
        await this.shot('finished-bible-reopened');
    }

    /** Samples until `until` holds; a sentence may be out of view only while a scroll glides. */
    async watch(name: string, until: (sample: Sample | null) => boolean, timeoutMs: number) {
        const samples: Sample[] = [];
        const start = Date.now();
        let hiddenSince: number | null = null;
        let longestHidden = 0;
        let shots = 0;
        while (Date.now() - start < timeoutMs) {
            const sample = await this.cdp.evaluate<Omit<Sample, 'at'> | null>(READ_SAMPLE);
            const now = Date.now() - start;
            if (sample) {
                samples.push({ ...sample, at: now });
                if (!sample.visible) {
                    hiddenSince ??= now;
                    longestHidden = Math.max(longestHidden, now - hiddenSince);
                } else {
                    hiddenSince = null;
                }
                const previous = samples.at(-2);
                if (
                    shots < 6 &&
                    previous &&
                    previous.text !== sample.text &&
                    samples.length % 4 === 0
                ) {
                    await this.shot(`${name}-${String(++shots).padStart(2, '0')}`);
                }
            }
            if (until(sample ? { ...sample, at: now } : null)) break;
            await sleep(100);
        }
        writeFileSync(join(this.outDir, `${name}-samples.json`), JSON.stringify(samples, null, 1));
        const sentences = new Set(samples.map((s) => `${s.paragraph}:${s.text}`)).size;
        return { samples, longestHidden, sentences };
    }
}

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            out: { type: 'string' },
            'cache-dir': { type: 'string' },
            voice: { type: 'string', default: 'sherpa' },
            only: { type: 'string' },
        },
    });
    const outDir = resolve(values.out ?? join(repoRoot, 'tmp/e2e-output/follow-reading'));
    mkdirSync(outDir, { recursive: true });
    const server = await startMockLlmServer({ logFile: join(outDir, 'llm-requests.jsonl') });
    const app = new AppProcess({ repoRoot, profileParent: join(repoRoot, 'tmp/e2e-profiles') });
    let run: FollowReadingRun | null = null;
    try {
        const cdp = await app.start();
        const cacheDir = resolve(values['cache-dir'] ?? join(repoRoot, 'tmp/e2e-cache'));
        await setUpApp(cdp, app, {
            repoRoot,
            cacheDir,
            mockBaseUrl: server.baseUrl,
            mockModelId: MOCK_MODEL_ID,
            languageCode: 'fr',
        });
        run = new FollowReadingRun(cdp, outDir);
        if (values.voice === 'sherpa') await run.installSherpaVoice(app.appDataDir, cacheDir);
        await run.setViewport(1024, 560);
        await run.prepare(values.voice ?? 'sherpa');

        if (values.only === 'finished') {
            console.log('Documents read to their end open at the start');
            await run.finishedReading();
            return;
        }

        console.log('Small window (1024×560): read the long paragraph');
        await run.play();
        const seen = new Set<string>();
        const long = await run.watch(
            'small',
            (s) => {
                if (s?.paragraph === 2) seen.add(s.text);
                return seen.size >= 9;
            },
            240_000,
        );
        run.check(
            `the spoken sentence stayed visible through the long paragraph (${long.sentences} sentences, longest out of view ${long.longestHidden} ms)`,
            long.sentences >= 9 && long.longestHidden <= 700,
            { sentences: long.sentences, longestHidden: long.longestHidden },
        );
        const firstOfLong = long.samples.find((s) => s.paragraph === 2);
        run.check(
            'the long paragraph opened on its first sentence near the top, not on its middle',
            !!firstOfLong &&
                firstOfLong.top - firstOfLong.viewTop <
                    (firstOfLong.viewBottom - firstOfLong.viewTop) * 0.45,
            firstOfLong,
        );

        console.log('Small window: the reader scrolls away in the middle of the paragraph');
        const before = await cdp.evaluate<number>(`${SCROLLER}.scrollTop`);
        await cdp.send('Input.dispatchMouseEvent', {
            type: 'mouseWheel',
            x: 400,
            y: 300,
            deltaX: 0,
            deltaY: -600,
        });
        await sleep(300);
        const scrolledTo = await cdp.evaluate<number>(`${SCROLLER}.scrollTop`);
        const away = await run.watch('away', (s) => s?.paragraph !== 2, 120_000);
        const awayInParagraph = away.samples.filter((s) => s.paragraph === 2);
        const afterWait = await cdp.evaluate<number>(`${SCROLLER}.scrollTop`);
        run.check(
            `the view stays where the reader scrolled while the paragraph goes on (${awayInParagraph.length} samples)`,
            scrolledTo < before &&
                awayInParagraph.length > 10 &&
                awayInParagraph.every((s) => !s.visible),
            { before, scrolledTo, afterWait, last: awayInParagraph.at(-1) },
        );
        const resumed = await run.watch('resume', (s) => !!s?.visible, 15_000);
        run.check(
            'follow reading picks up again at the next paragraph',
            resumed.samples.some((s) => s.visible),
            resumed.samples.at(-1),
        );

        console.log('Small window: a single sentence taller than the view');
        const tallSentence = await run.watch('tall', (s) => s?.paragraph === 5, 240_000);
        const tallSamples = tallSentence.samples.filter((s) => s.paragraph === 4);
        run.check(
            'the start of a sentence taller than the view is shown',
            tallSamples.length > 0 &&
                tallSamples.every((s) => s.top >= s.viewTop - 1 && s.top < s.viewBottom),
            tallSamples.at(-1),
        );
        await run.shot('small-end');
        await run.stop();

        console.log('Normal window (1440×900): the read sentence stays visible');
        await run.setViewport(1440, 900);
        await run.play();
        const startedAt = Date.now();
        const normal = await run.watch('normal', () => Date.now() - startedAt > 15_000, 20_000);
        run.check(
            `the spoken sentence stayed visible in a normal window (${normal.sentences} sentences)`,
            normal.sentences >= 2 && normal.longestHidden <= 700,
            { sentences: normal.sentences, longestHidden: normal.longestHidden },
        );
        await run.shot('normal');

        console.log('Back to the start while the voice reads');
        for (const deltaY of [2500, -400]) {
            await cdp.send('Input.dispatchMouseEvent', {
                type: 'mouseWheel',
                x: 500,
                y: 500,
                deltaX: 0,
                deltaY,
            });
            await sleep(700);
        }
        await new ChatPage(cdp, outDir).clickElement(
            `document.querySelector('.document-top-button--visible button')`,
            'the back-to-start button',
        );
        await sleep(8000);
        const stillAtStart = await cdp.evaluate<number>(`${SCROLLER}.scrollTop`);
        const stillReading = await cdp.evaluate<boolean>(
            `Boolean(document.querySelector('.tts-active-sentence'))`,
        );
        run.check(
            'after going back to the start, the view stays there while the voice reads on',
            stillAtStart === 0 && stillReading,
            { stillAtStart, stillReading },
        );
        await run.stop();

        console.log('Back-to-start button');
        await run.topButton('1440');
        await run.setViewport(1024, 560);
        await run.topButton('1024x560');

        console.log('Documents read to their end open at the start');
        await run.finishedReading();
    } finally {
        const passed = run?.results.filter((r) => r.passed).length ?? 0;
        const total = run?.results.length ?? 0;
        writeFileSync(join(outDir, 'results.json'), JSON.stringify(run?.results ?? [], null, 2));
        console.log(`\n${passed}/${total} checks passed. Output: ${outDir}`);
        writeFileSync(join(outDir, 'main.log'), app.mainLog());
        await app.stop();
        await server.close();
        if (!run || passed !== total || total === 0) process.exitCode = 1;
    }
}

await main();
