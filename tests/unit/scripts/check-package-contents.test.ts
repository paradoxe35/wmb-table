import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script, no type declarations
import {
    checkPackageContents,
    findForbiddenEntries,
    listAsarEntries,
} from '../../../scripts/check-package-contents.mjs';

type AsarNode = { files: Record<string, AsarNode> } | { size: number; offset: string };

let dir = '';

beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'wmb-package-'));
});

afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

function toAsarTree(paths: string[]): AsarNode {
    const root: AsarNode = { files: {} };
    for (const entryPath of paths) {
        let node = root as { files: Record<string, AsarNode> };
        const names = entryPath.split('/');
        names.forEach((name, index) => {
            if (index === names.length - 1) {
                node.files[name] = { size: 0, offset: '0' };
                return;
            }
            node.files[name] ??= { files: {} };
            node = node.files[name] as { files: Record<string, AsarNode> };
        });
    }
    return root;
}

function encodeAsarHeader(paths: string[]): Buffer {
    const json = Buffer.from(JSON.stringify(toAsarTree(paths)));
    const paddedJsonLength = Math.ceil(json.length / 4) * 4;
    const headerPickle = Buffer.alloc(8 + paddedJsonLength);
    headerPickle.writeUInt32LE(4 + paddedJsonLength, 0);
    headerPickle.writeUInt32LE(json.length, 4);
    json.copy(headerPickle, 8);
    const sizePickle = Buffer.alloc(8);
    sizePickle.writeUInt32LE(4, 0);
    sizePickle.writeUInt32LE(headerPickle.length, 4);
    return Buffer.concat([sizePickle, headerPickle]);
}

async function seedPackagedApp(asarPaths: string[], resources: string[]): Promise<string> {
    const resourcesDir = join(dir, 'linux-unpacked', 'resources');
    await mkdir(resourcesDir, { recursive: true });
    await writeFile(join(resourcesDir, 'app.asar'), encodeAsarHeader(asarPaths));
    for (const resource of resources) {
        await mkdir(join(resourcesDir, resource, '..'), { recursive: true });
        await writeFile(join(resourcesDir, resource), '');
    }
    return resourcesDir;
}

const BUILT_APP = ['package.json', 'out/main/index.js', 'node_modules/zod/package.json'];
const BUNDLED_RESOURCES = ['database/data.sqlite', 'database/bible-index.json', 'drizzle'];

describe('findForbiddenEntries', () => {
    it('accepts the built app and production node_modules', () => {
        expect(findForbiddenEntries([...BUILT_APP, 'out', 'node_modules'])).toEqual([]);
    });

    it('rejects every top-level entry besides out, node_modules and package.json', () => {
        const local = [
            'tmp/token.txt',
            '.claude/worktrees/x',
            'src/main/index.ts',
            'tests/a.test.ts',
        ];
        const more = ['docs/index.md', 'specs/a.md', 'scripts/a.mjs', 'release/a', 'coverage/a'];
        expect(findForbiddenEntries([...local, ...more, 'README.md'])).toEqual([
            ...local,
            ...more,
            'README.md',
        ]);
    });

    it('rejects env files and SQLite databases anywhere, even inside allowed folders', () => {
        const leaked = ['.env', '.env.local', 'out/.env', 'out/sync.sqlite', 'out/a.sqlite-wal'];
        expect(findForbiddenEntries([...leaked, 'out/environment.js'])).toEqual(leaked);
    });
});

describe('listAsarEntries', () => {
    it('lists folders and files from the asar header', async () => {
        await seedPackagedApp(['out/main/index.js', 'package.json'], []);
        const entries = await listAsarEntries(join(dir, 'linux-unpacked', 'resources', 'app.asar'));
        expect(entries).toEqual(['out', 'out/main', 'out/main/index.js', 'package.json']);
    });
});

describe('checkPackageContents', () => {
    it('passes a clean package with its bundled databases beside the asar', async () => {
        await seedPackagedApp(BUILT_APP, BUNDLED_RESOURCES);
        const { archives, problems } = await checkPackageContents(dir);
        expect(archives).toHaveLength(1);
        expect(problems).toEqual([]);
    });

    it('reports local files that leaked into the asar', async () => {
        await seedPackagedApp([...BUILT_APP, 'tmp/decoy.txt', 'decoy.sqlite'], BUNDLED_RESOURCES);
        const { problems } = await checkPackageContents(dir);
        expect(problems[0].forbidden).toEqual(['tmp', 'tmp/decoy.txt', 'decoy.sqlite']);
    });

    it('reports bundled databases missing from the resources folder', async () => {
        await seedPackagedApp(BUILT_APP, ['drizzle']);
        const { problems } = await checkPackageContents(dir);
        expect(problems[0].missing).toEqual(['database/data.sqlite', 'database/bible-index.json']);
    });

    it('fails when nothing was packaged', async () => {
        await expect(checkPackageContents(dir)).rejects.toThrow('No app.asar found');
    });
});

describe('electron-builder files config', () => {
    // A platform `files` list made only of exclusions makes electron-builder package the
    // whole project directory, ignoring the top-level allow-list.
    it('gives every platform files list its own allow-list', async () => {
        const { build } = JSON.parse(await readFile('package.json', 'utf8'));
        const platformFiles = ['linux', 'mac', 'win']
            .map((platform) => build[platform]?.files as string[] | undefined)
            .filter((files) => files !== undefined);

        for (const files of [build.files, ...platformFiles]) {
            expect(files).toContain('out/**/*');
        }
    });
});
