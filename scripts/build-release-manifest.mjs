import { promises as fs } from 'node:fs';
import path from 'node:path';

const artifactsDir = process.argv[2] ?? 'artifacts';
const outputFile = process.argv[3] ?? path.join(artifactsDir, 'latest.json');

const releaseVersion = process.env.RELEASE_VERSION;
const storageBucket = 'wmb-table.appspot.com';
const storagePrefix = process.env.RELEASE_STORAGE_PREFIX ?? 'releases';

if (!releaseVersion) {
    throw new Error('Missing RELEASE_VERSION');
}

function normalize(name) {
    return name.toLowerCase();
}

function isVisibleDownload(name) {
    const lower = normalize(name);
    return (
        lower.endsWith('.exe') ||
        lower.endsWith('.dmg') ||
        lower.endsWith('.appimage') ||
        lower.endsWith('.deb') ||
        lower.endsWith('.tar.gz') ||
        lower.endsWith('-win.zip') ||
        lower.endsWith('-mac.zip')
    );
}

function detectPlatform(name) {
    const lower = normalize(name);
    if (lower.endsWith('.exe') || lower.endsWith('-win.zip')) return 'windows';
    if (lower.endsWith('.dmg') || lower.endsWith('-mac.zip')) return 'mac';
    if (lower.endsWith('.appimage') || lower.endsWith('.deb') || lower.endsWith('.tar.gz')) return 'linux';
    return 'other';
}

function detectArch(name, platform) {
    const lower = normalize(name);
    if (/(arm64|aarch64)/.test(lower)) return 'arm64';
    if (/(x64|amd64|x86_64)/.test(lower)) return 'x64';
    if (platform === 'mac' || platform === 'windows' || platform === 'linux') return 'x64';
    return 'unknown';
}

function detectKind(name) {
    const lower = normalize(name);
    if (lower.endsWith('.exe') || lower.endsWith('.dmg')) return 'installer';
    if (lower.endsWith('.deb')) return 'package';
    if (lower.endsWith('.appimage') || lower.endsWith('.tar.gz') || lower.endsWith('.zip')) return 'portable';
    return 'download';
}

function extensionRank(name) {
    const lower = normalize(name);
    if (lower.endsWith('.exe')) return 0;
    if (lower.endsWith('.dmg')) return 0;
    if (lower.endsWith('.appimage')) return 0;
    if (lower.endsWith('.deb')) return 1;
    if (lower.endsWith('.tar.gz')) return 2;
    if (lower.endsWith('.zip')) return 3;
    return 99;
}

function platformRank(platform) {
    if (platform === 'windows') return 0;
    if (platform === 'mac') return 1;
    if (platform === 'linux') return 2;
    return 99;
}

function buildDownloadUrl(fileName) {
    const objectPath = `${storagePrefix}/${fileName}`;
    return `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(objectPath)}?alt=media`;
}

const entries = await fs.readdir(artifactsDir, { withFileTypes: true });

const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name !== path.basename(outputFile))
    .filter(isVisibleDownload);

const assets = await Promise.all(
    files.map(async (name) => {
        const platform = detectPlatform(name);
        const stats = await fs.stat(path.join(artifactsDir, name));

        return {
            name,
            url: buildDownloadUrl(name),
            platform,
            arch: detectArch(name, platform),
            kind: detectKind(name),
            sizeBytes: stats.size,
        };
    }),
);

assets.sort((left, right) => {
        const platformDiff = platformRank(left.platform) - platformRank(right.platform);
        if (platformDiff !== 0) return platformDiff;

        const extDiff = extensionRank(left.name) - extensionRank(right.name);
        if (extDiff !== 0) return extDiff;

        return left.name.localeCompare(right.name);
    });

const manifest = {
    version: releaseVersion,
    generatedAt: new Date().toISOString(),
    assets,
};

await fs.writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
