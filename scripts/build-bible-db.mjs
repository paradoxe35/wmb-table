#!/usr/bin/env node
/**
 * Build Bible SQLite databases from supported free-license sources.
 *
 * Usage:
 *   node scripts/build-bible-db.mjs                  # Build & verify all resolved versions
 *   node scripts/build-bible-db.mjs darby kjv        # Build & verify specific versions
 *   node scripts/build-bible-db.mjs --force          # Delete & rebuild all from scratch
 *   node scripts/build-bible-db.mjs --force darby    # Force rebuild specific versions
 *   node scripts/build-bible-db.mjs --list           # List resolved versions
 */

import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CONCURRENCY,
    LOCAL_DIR,
    REMOTE_DIR,
    SUPPORTED_LANGUAGES_DB_PATH,
} from './bible-db/config.mjs';
import { fetchSourceBibleData, resolveVersionCatalog } from './bible-db/catalog.mjs';
import { openOrCreateDatabase, syncBibleDatabase } from './bible-db/sqlite.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_INDEX_PATH = join(__dirname, '..', 'resources', 'database', 'bible-index.json');

function outputDir(config) {
    return config.distribution === 'local' ? LOCAL_DIR : REMOTE_DIR;
}

async function buildVersion(config, force) {
    const dir = outputDir(config);
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, config.fileName);
    const label = `${config.name} (${config.abbreviation})`;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${label} [${config.distribution}] [${config.source}]`);
    console.log(`${'─'.repeat(60)}`);

    const sourceData = await fetchSourceBibleData(config);
    if (!sourceData) {
        console.log(`  ✗ Could not fetch Bible content for "${config.abbreviation}", skipping.`);
        return 'error';
    }

    console.log(
        `  ${sourceData.chapterRows.length} chapters, ${sourceData.verseRows.length} verses fetched from ${config.source}`,
    );

    const { db, isNew } = openOrCreateDatabase(dbPath, force);
    const summary = syncBibleDatabase(db, sourceData);
    db.close();

    if (summary.finalVerseCount !== sourceData.verseRows.length) {
        console.error(
            `  ✗ INTEGRITY ERROR: DB has ${summary.finalVerseCount} verses but API returned ${sourceData.verseRows.length} verses.`,
        );
        return 'error';
    }

    const sizeMb = (statSync(dbPath).size / (1024 * 1024)).toFixed(1);

    if (isNew) {
        console.log(`  ✓ Created: ${summary.inserted} verses, ${sizeMb} MB`);
    } else if (summary.inserted === 0 && summary.updated === 0 && summary.deleted === 0) {
        console.log(`  ✓ Verified: ${summary.unchanged} verses accurate, ${sizeMb} MB`);
    } else {
        console.log(
            `  ✓ Synced: +${summary.inserted} inserted, ~${summary.updated} fixed, -${summary.deleted} orphans removed, ${summary.unchanged} ok, ${sizeMb} MB`,
        );
    }

    return summary.inserted === 0 && summary.updated === 0 && summary.deleted === 0 && !isNew
        ? 'unchanged'
        : 'built';
}

async function runParallel(versions, force) {
    let built = 0;
    let unchanged = 0;
    let errors = 0;

    for (let index = 0; index < versions.length; index += CONCURRENCY) {
        const batch = versions.slice(index, index + CONCURRENCY);
        const results = await Promise.all(batch.map((config) => buildVersion(config, force)));
        for (const result of results) {
            if (result === 'built') built++;
            else if (result === 'unchanged') unchanged++;
            else errors++;
        }
    }

    return { built, unchanged, errors };
}

function writeIndex(indexPath, versions, distribution) {
    const entries = versions
        .filter((version) => version.distribution === distribution)
        .map((version) => ({
            langCode: version.langCode,
            abbreviation: version.abbreviation,
            name: version.name,
            fileName: version.fileName,
            type: distribution,
        }));

    writeFileSync(indexPath, JSON.stringify(entries, null, 4) + '\n');
    console.log(`\n${distribution} index: ${indexPath} (${entries.length} versions)`);
}

function writeBuildManifest(indexPath, versions, skippedLanguages, skippedVersions) {
    const manifest = {
        generatedAt: new Date().toISOString(),
        versions: versions.map((version) => ({
            langCode: version.langCode,
            abbreviation: version.abbreviation,
            name: version.name,
            fileName: version.fileName,
            distribution: version.distribution,
            source: version.source,
            sourceVersionId: version.sourceVersionId,
        })),
        skippedLanguages,
        skippedVersions,
    };

    writeFileSync(indexPath, JSON.stringify(manifest, null, 4) + '\n');
    console.log(`build manifest: ${indexPath}`);
}

const args = process.argv.slice(2);
const listFlag = args.includes('--list');
const forceFlag = args.includes('--force');
const versionArgs = args.filter((arg) => !arg.startsWith('--'));

const { versions, skippedLanguages, skippedVersions } = await resolveVersionCatalog({
    supportedLanguagesDbPath: SUPPORTED_LANGUAGES_DB_PATH,
});
const versionMap = new Map(versions.map((version) => [version.abbreviation, version]));

if (listFlag) {
    console.log('Available versions:');
    for (const version of versions) {
        console.log(
            `  ${version.abbreviation.padEnd(18)} ${version.name.padEnd(38)} (${version.langCode}) [${version.distribution}] [${version.source}]`,
        );
    }

    if (skippedLanguages.length > 0) {
        console.log('\nSupported languages without a resolved free Bible version:');
        console.log(`  ${skippedLanguages.join(', ')}`);
    }

    if (skippedVersions.length > 0) {
        console.log('\nSkipped version candidates:');
        for (const skipped of skippedVersions) {
            console.log(`  ${skipped.abbreviation}: ${skipped.reason}`);
        }
    }
    process.exit(0);
}

const versionsToBuild =
    versionArgs.length > 0
        ? versionArgs.map((abbreviation) => {
              const version = versionMap.get(abbreviation);
              if (!version) {
                  console.error(
                      `Error: Unknown version '${abbreviation}'. Use --list to see available versions.`,
                  );
                  process.exit(1);
              }
              return version;
          })
        : versions;

console.log(`Processing ${versionsToBuild.length} versions (${CONCURRENCY} in parallel)...`);
const { built, unchanged, errors } = await runParallel(versionsToBuild, forceFlag);

console.log(`\n${'='.repeat(60)}`);
console.log(
    `Done: ${built} built, ${unchanged} unchanged, ${errors} errors, ${versionsToBuild.length} total`,
);
console.log(`${'='.repeat(60)}`);

writeIndex(LOCAL_INDEX_PATH, versions, 'local');
writeIndex(join(REMOTE_DIR, 'bible-index.json'), versions, 'remote');
writeBuildManifest(
    join(REMOTE_DIR, 'bible-build-manifest.json'),
    versions,
    skippedLanguages,
    skippedVersions,
);

if (skippedLanguages.length > 0) {
    console.log(`\nNo free Bible version resolved for: ${skippedLanguages.join(', ')}`);
}
