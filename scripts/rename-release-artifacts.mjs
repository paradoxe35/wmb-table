/**
 * Renames built artifacts to the names electron-updater expects to find.
 *
 * `productName` contains a space, so electron-builder writes a GitHub-safe name
 * (space → dash) into `latest*.yml` and relies on its own publisher to upload the
 * asset under that same name. This workflow builds with `--publish never` and
 * uploads separately, so without this step GitHub stores the raw file name with
 * spaces rewritten to dots — `Wmb.Table-2.0.1.AppImage` against a manifest asking
 * for `Wmb-Table-2.0.1.AppImage` — and every download fails with
 * ERR_UPDATER_ASSET_NOT_FOUND on every platform.
 *
 * Mirrors `computeSafeArtifactNameIfNeeded` in app-builder-lib.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const artifactsDir = process.argv[2] ?? 'artifacts';

/** GitHub only keeps these characters verbatim in an asset name */
function isSafeGitHubName(name) {
    return /^[0-9A-Za-z._-]+$/.test(name);
}

export function toSafeArtifactName(name) {
    if (isSafeGitHubName(name)) return name;
    const dashed = name.replace(/ /g, '-');
    return isSafeGitHubName(dashed) ? dashed : null;
}

export async function renameReleaseArtifacts(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const renamed = [];

    for (const entry of entries) {
        if (!entry.isFile()) continue;

        const safeName = toSafeArtifactName(entry.name);
        if (safeName === null) {
            throw new Error(
                `Cannot derive a GitHub-safe name for "${entry.name}". electron-builder would ` +
                    `have generated an unrelated name, so latest*.yml can no longer be trusted.`,
            );
        }
        if (safeName === entry.name) continue;

        const target = path.join(directory, safeName);
        if (entries.some((other) => other.name === safeName)) {
            throw new Error(`Renaming "${entry.name}" would overwrite "${safeName}"`);
        }

        await fs.rename(path.join(directory, entry.name), target);
        renamed.push([entry.name, safeName]);
    }

    return renamed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const renamed = await renameReleaseArtifacts(artifactsDir);
    for (const [from, to] of renamed) {
        console.log(`${from} -> ${to}`);
    }
    console.log(`Renamed ${renamed.length} artifact(s) to their GitHub-safe names`);
}
