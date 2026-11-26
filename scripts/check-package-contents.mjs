/**
 * Fails when a packaged app.asar holds anything besides the built app, or when the bundled
 * databases shipped beside it (extraResources) are missing.
 *
 * electron-builder silently falls back to packaging the whole project directory when a
 * platform-level `files` list contains only exclusions, which shipped src/, tests/, docs/
 * and any local secrets or databases lying in the checkout. Run after packaging.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ALLOWED_TOP_LEVEL_ENTRIES = new Set(['out', 'node_modules', 'package.json']);
const FORBIDDEN_FILE_NAME = /^\.env(\.|$)|\.sqlite/;
const REQUIRED_RESOURCES = ['database/data.sqlite', 'database/bible-index.json', 'drizzle'];

export function findForbiddenEntries(entryPaths) {
    return entryPaths.filter((entryPath) => {
        const [topLevelEntry] = entryPath.split('/');
        return (
            !ALLOWED_TOP_LEVEL_ENTRIES.has(topLevelEntry) ||
            FORBIDDEN_FILE_NAME.test(path.posix.basename(entryPath))
        );
    });
}

function flattenAsarTree(directory, prefix = '') {
    return Object.entries(directory.files).flatMap(([name, node]) => {
        const entryPath = prefix ? `${prefix}/${name}` : name;
        return node.files ? [entryPath, ...flattenAsarTree(node, entryPath)] : [entryPath];
    });
}

// The asar header is a Chromium pickle: [4][headerSize] then [payloadSize][jsonLength][json].
export async function listAsarEntries(asarPath) {
    const file = await fs.open(asarPath, 'r');
    try {
        const sizePickle = Buffer.alloc(8);
        await file.read(sizePickle, 0, 8, 0);
        const headerPickle = Buffer.alloc(sizePickle.readUInt32LE(4));
        await file.read(headerPickle, 0, headerPickle.length, 8);
        const jsonLength = headerPickle.readUInt32LE(4);
        const header = JSON.parse(headerPickle.toString('utf8', 8, 8 + jsonLength));
        return flattenAsarTree(header);
    } finally {
        await file.close();
    }
}

export async function findAsarArchives(releaseDir) {
    const entries = await fs.readdir(releaseDir, { recursive: true });
    return entries
        .filter((entry) => path.basename(entry) === 'app.asar')
        .map((entry) => path.join(releaseDir, entry));
}

async function pathExists(target) {
    return fs.access(target).then(
        () => true,
        () => false,
    );
}

export async function findMissingResources(resourcesDir) {
    const present = await Promise.all(
        REQUIRED_RESOURCES.map((resource) => pathExists(path.join(resourcesDir, resource))),
    );
    return REQUIRED_RESOURCES.filter((_, index) => !present[index]);
}

export async function checkPackageContents(releaseDir) {
    const archives = await findAsarArchives(releaseDir);
    if (archives.length === 0) {
        throw new Error(`No app.asar found under ${releaseDir}`);
    }

    const problems = [];
    for (const archive of archives) {
        const forbidden = findForbiddenEntries(await listAsarEntries(archive));
        const missing = await findMissingResources(path.dirname(archive));
        if (forbidden.length > 0 || missing.length > 0) {
            problems.push({ archive, forbidden, missing });
        }
    }
    return { archives, problems };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const releaseDir = process.argv[2] ?? 'release';
    const { archives, problems } = await checkPackageContents(releaseDir);

    for (const { archive, forbidden, missing } of problems) {
        if (forbidden.length > 0) {
            console.error(
                `${archive} contains ${forbidden.length} forbidden entries, for example:`,
            );
            for (const entry of forbidden.slice(0, 20)) console.error(`  ${entry}`);
        }
        for (const resource of missing) console.error(`${archive}: missing resource ${resource}`);
    }
    if (problems.length > 0) process.exit(1);

    console.log(`Checked ${archives.length} app.asar archive(s): clean, bundled resources present`);
}
