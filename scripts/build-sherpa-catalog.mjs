/**
 * Rebuilds `resources/tts/sherpa-catalog.json` from the places the voices actually live.
 *
 * The bundled catalog is only a head start: at runtime the app refreshes it from the same
 * sherpa-onnx release. The two must therefore agree, so this script calls the app's own
 * fetcher and parser rather than re-deriving anything — a bundled entry and a refreshed one
 * differ only in when they were fetched.
 *
 * MMS voices sit outside that release, one directory per language in a HuggingFace repo,
 * and are read here alone: nothing in the app discovers them at runtime.
 *
 * Every field written here is stated by the host. What a download URL cannot tell us — how
 * many voices a model holds, how well it was trained — is left out rather than guessed.
 *
 * Usage: pnpm catalog:sherpa [--dry-run]
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalizeLanguageCode } from '@shared/tts.types';
import { toMegabytes } from '@main/services/tts/sherpa-catalog-parser';
import { fetchSherpaReleaseEntries } from '@main/services/tts/sherpa-release';

const CATALOG_PATH = fileURLToPath(new URL('../resources/tts/sherpa-catalog.json', import.meta.url));

const MMS_REPO = 'willwade/mms-tts-multilingual-models-onnx';
const MMS_TREE_URL = `https://huggingface.co/api/models/${MMS_REPO}/tree/main`;
const MMS_FILES_URL = `https://huggingface.co/${MMS_REPO}/resolve/main`;
const MMS_LANGUAGES_URL = `${MMS_FILES_URL}/languages-supported.json`;

/** The files the worker downloads for an MMS voice; the sample recordings are never fetched. */
const MMS_VOICE_FILES = ['model.onnx', 'tokens.txt'];

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
const REQUEST_TIMEOUT_MS = 30_000;

async function fetchJson(url) {
    const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'wmb-table' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) throw new Error(`${url} responded ${response.status}`);

    const nextPage = /<([^>]+)>;\s*rel="next"/.exec(response.headers.get('link') ?? '');
    return { data: await response.json(), nextUrl: nextPage?.[1] ?? null };
}

/** Every file in the MMS repo, walked page by page the way HuggingFace hands them over. */
async function fetchMmsFiles() {
    const files = [];
    let url = `${MMS_TREE_URL}?recursive=true&limit=${PAGE_SIZE}`;

    for (let page = 0; url && page < MAX_PAGES; page++) {
        const { data, nextUrl } = await fetchJson(url);
        files.push(...data.filter((entry) => entry.type === 'file'));
        url = nextUrl;
    }

    return files;
}

/**
 * One entry per directory holding a complete voice. The size is what the app will really
 * download, and the name comes from the repo's own language table; only the language code
 * is read off the directory name, by the same rule the app applies to an installed model.
 */
export function buildMmsEntries(files, languages) {
    const voiceFiles = new Map();

    for (const file of files) {
        const [directory, fileName, ...rest] = file.path.split('/');
        if (rest.length > 0 || !MMS_VOICE_FILES.includes(fileName)) continue;

        const sizes = voiceFiles.get(directory) ?? new Map();
        sizes.set(fileName, file.size);
        voiceFiles.set(directory, sizes);
    }

    const names = new Map(languages.map((row) => [row['Iso Code'], row['Language Name']]));

    return [...voiceFiles]
        .filter(([, sizes]) => MMS_VOICE_FILES.every((fileName) => sizes.has(fileName)))
        .map(([directory, sizes]) => ({
            engine: 'mms',
            name: names.get(directory) ?? directory,
            langCode: [normalizeLanguageCode(directory)],
            filesizeMb: toMegabytes([...sizes.values()].reduce((total, size) => total + size, 0)),
            url: `${MMS_FILES_URL}/${directory}`,
            modelName: `mms-${directory}`,
        }))
        .sort(byField('name'));
}

/** Plain code-point order, so a rebuild on another machine produces the very same file. */
function byField(field) {
    return (left, right) => {
        if (left[field] === right[field]) return 0;
        return left[field] < right[field] ? -1 : 1;
    };
}

/** Release models first, then MMS, each in a fixed order so a rebuild only shows real news. */
export function mergeCatalog(releaseEntries, mmsEntries) {
    return [...releaseEntries].sort(byField('modelName')).concat([...mmsEntries]);
}

export function summarizeChanges(previous, next) {
    const before = new Map(previous.map((entry) => [entry.modelName, JSON.stringify(entry)]));
    const after = new Map(next.map((entry) => [entry.modelName, JSON.stringify(entry)]));

    return {
        added: [...after.keys()].filter((name) => !before.has(name)),
        removed: [...before.keys()].filter((name) => !after.has(name)),
        changed: [...after].filter(([name, entry]) => before.has(name) && before.get(name) !== entry)
            .length,
    };
}

async function formatJson(entries) {
    const prettier = await import('prettier');
    const options = await prettier.resolveConfig(CATALOG_PATH);
    return prettier.format(JSON.stringify(entries), { ...options, filepath: CATALOG_PATH });
}

async function readCurrentCatalog() {
    try {
        return JSON.parse(await readFile(CATALOG_PATH, 'utf-8'));
    } catch {
        return [];
    }
}

async function main({ dryRun }) {
    const [releaseEntries, mmsFiles, mmsLanguages] = await Promise.all([
        fetchSherpaReleaseEntries(),
        fetchMmsFiles(),
        fetchJson(MMS_LANGUAGES_URL).then(({ data }) => data),
    ]);

    const mmsEntries = buildMmsEntries(mmsFiles, mmsLanguages);

    // An empty list means a host answered but told us nothing; overwriting would strip the
    // app of every voice it can offer.
    if (releaseEntries.length === 0) throw new Error('The sherpa-onnx release listed no models');
    if (mmsEntries.length === 0) throw new Error('The MMS repository listed no voices');

    const entries = mergeCatalog(releaseEntries, mmsEntries);
    const { added, removed, changed } = summarizeChanges(await readCurrentCatalog(), entries);

    console.log(`${releaseEntries.length} models from the release, ${mmsEntries.length} from MMS`);
    console.log(`${added.length} added, ${removed.length} removed, ${changed} changed`);
    for (const name of [...added.map((n) => `+ ${n}`), ...removed.map((n) => `- ${n}`)]) {
        console.log(`  ${name}`);
    }

    if (dryRun) {
        console.log('Dry run: catalog left untouched');
        return;
    }

    await writeFile(CATALOG_PATH, await formatJson(entries), 'utf-8');
    console.log(`Wrote ${entries.length} models to ${CATALOG_PATH}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await main({ dryRun: process.argv.includes('--dry-run') });
}
