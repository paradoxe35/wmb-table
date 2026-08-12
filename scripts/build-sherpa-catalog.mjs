/**
 * Rebuilds `resources/tts/sherpa-catalog.json` from the places the voices actually live.
 *
 * The app refreshes the same sherpa-onnx release at runtime, so this calls the app's own
 * fetcher and parser rather than re-deriving anything. MMS voices sit outside that release,
 * in a HuggingFace repo, and are read here alone.
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

/** What the worker downloads for an MMS voice; the sample recordings are not fetched. */
const MMS_VOICE_FILES = ['model.onnx', 'tokens.txt'];

/** ISO 15924 subtags for the writing systems MMS spells out, so the interface can name them. */
const MMS_SCRIPTS = {
    arabic: 'Arab',
    cyrillic: 'Cyrl',
    devanagari: 'Deva',
    ethiopic: 'Ethi',
    khmer: 'Khmr',
    latin: 'Latn',
    syllabics: 'Cans',
    telugu: 'Telu',
    tifinagh: 'Tfng',
};

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
 * `bcc-script_arabic`, `cac-dialect_sanmateoixtatán`: without the suffix, several voices of
 * one language look identical. A script has a subtag the interface can name; a dialect has
 * none, so its own name is all there is to show.
 */
function describeVariant(directory, languageName) {
    const [code, variant] = directory.split('-');
    const langCode = normalizeLanguageCode(code);
    const [kind, value] = variant?.split('_') ?? [];

    if (kind === 'script' && MMS_SCRIPTS[value]) {
        return { name: languageName, langCode: [`${langCode}-${MMS_SCRIPTS[value]}`] };
    }

    return {
        name: value ? `${languageName} (${value})` : languageName,
        langCode: [langCode],
    };
}

/** One entry per directory holding a complete voice. */
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
            ...describeVariant(directory, names.get(directory) ?? directory),
            filesizeMb: toMegabytes([...sizes.values()].reduce((total, size) => total + size, 0)),
            url: `${MMS_FILES_URL}/${directory}`,
            modelName: `mms-${directory}`,
        }))
        .sort(byField('name'));
}

/** Code-point order, so a rebuild on another machine produces the same file. */
function byField(field) {
    return (left, right) => {
        if (left[field] === right[field]) return 0;
        return left[field] < right[field] ? -1 : 1;
    };
}

/** A fixed order, so a rebuild only shows what really moved. */
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

    // A host that answers with nothing would otherwise strip the app of every voice.
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
