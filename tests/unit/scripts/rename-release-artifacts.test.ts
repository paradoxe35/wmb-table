import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script, no type declarations
import {
    renameReleaseArtifacts,
    toSafeArtifactName,
} from '../../../scripts/rename-release-artifacts.mjs';

let dir = '';

beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'wmb-artifacts-'));
});

afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

async function seed(names: string[]): Promise<void> {
    await Promise.all(names.map((name) => writeFile(join(dir, name), name)));
}

describe('toSafeArtifactName', () => {
    it('replaces the spaces electron-builder replaces', () => {
        expect(toSafeArtifactName('Wmb Table Setup 2.0.1.exe')).toBe('Wmb-Table-Setup-2.0.1.exe');
        expect(toSafeArtifactName('Wmb Table-2.0.1.AppImage')).toBe('Wmb-Table-2.0.1.AppImage');
        expect(toSafeArtifactName('Wmb Table-2.0.1-arm64-mac.zip.blockmap')).toBe(
            'Wmb-Table-2.0.1-arm64-mac.zip.blockmap',
        );
    });

    it('leaves already-safe names alone', () => {
        expect(toSafeArtifactName('wmb-table_2.0.1_amd64.deb')).toBe('wmb-table_2.0.1_amd64.deb');
        expect(toSafeArtifactName('latest-linux.yml')).toBe('latest-linux.yml');
    });

    it('refuses names a dash cannot rescue', () => {
        expect(toSafeArtifactName('Wmb Table (2.0.1).exe')).toBeNull();
    });
});

describe('renameReleaseArtifacts', () => {
    it('renames every artifact to the name latest*.yml points at', async () => {
        await seed([
            'Wmb Table Setup 2.0.1.exe',
            'Wmb Table Setup 2.0.1.exe.blockmap',
            'wmb-table_2.0.1_amd64.deb',
            'latest.yml',
        ]);

        const renamed = await renameReleaseArtifacts(dir);

        expect(renamed).toHaveLength(2);
        expect((await readdir(dir)).sort()).toEqual([
            'Wmb-Table-Setup-2.0.1.exe',
            'Wmb-Table-Setup-2.0.1.exe.blockmap',
            'latest.yml',
            'wmb-table_2.0.1_amd64.deb',
        ]);
    });

    it('is a no-op when nothing needs renaming', async () => {
        await seed(['wmb-table-2.0.1.x86_64.rpm', 'latest-mac.yml']);
        await expect(renameReleaseArtifacts(dir)).resolves.toEqual([]);
    });

    it('fails the release rather than guess at an unsafe name', async () => {
        await seed(['Wmb Table (2.0.1).exe']);
        await expect(renameReleaseArtifacts(dir)).rejects.toThrow(/GitHub-safe name/);
    });

    it('refuses to overwrite an existing artifact', async () => {
        await seed(['Wmb Table-2.0.1.AppImage', 'Wmb-Table-2.0.1.AppImage']);
        await expect(renameReleaseArtifacts(dir)).rejects.toThrow(/would overwrite/);
    });
});
