const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROMIUM_LOCALES_TO_KEEP = new Set([
    'en-US.pak',
    'en-GB.pak',
    'es.pak',
    'es-419.pak',
    'fr.pak',
    'pt-BR.pak',
    'pt-PT.pak',
    'sw.pak',
]);

function removeIfExists(targetPath) {
    fs.rmSync(targetPath, { recursive: true, force: true });
}

function pruneChromiumLocales(appOutDir) {
    const localeDirs = [
        path.join(appOutDir, 'locales'),
        path.join(
            appOutDir,
            'Wmb Table.app',
            'Contents',
            'Frameworks',
            'Electron Framework.framework',
            'Resources',
            'locales',
        ),
    ];

    for (const localesDir of localeDirs) {
        if (!fs.existsSync(localesDir)) continue;

        for (const localeFile of fs.readdirSync(localesDir)) {
            if (!CHROMIUM_LOCALES_TO_KEEP.has(localeFile)) {
                removeIfExists(path.join(localesDir, localeFile));
            }
        }
    }
}

function pruneBetterSqlitePayload(appOutDir) {
    const betterSqliteDir = path.join(
        appOutDir,
        'resources',
        'app.asar.unpacked',
        'node_modules',
        'better-sqlite3',
    );

    removeIfExists(path.join(betterSqliteDir, 'deps'));
    removeIfExists(path.join(betterSqliteDir, 'src'));
    removeIfExists(path.join(betterSqliteDir, 'binding.gyp'));
    removeIfExists(path.join(betterSqliteDir, 'README.md'));
}

/**
 * Re-sign the entire .app bundle with a consistent ad-hoc identity after packing.
 *
 * On macOS 26+, dyld strictly enforces that all binaries in a process share the
 * same Team ID. Without a paid Developer ID certificate, electron-builder produces
 * a bundle where the main binary is ad-hoc signed (no Team ID) but the embedded
 * Electron Framework retains Electron's original signature (different Team ID).
 * This causes a SIGABRT at launch with "different Team IDs".
 *
 * This hook re-signs everything with `codesign --force --deep --sign -` so all
 * binaries share the same (empty) ad-hoc Team ID.
 *
 * When a proper Developer ID certificate is available (CSC_LINK is set),
 * electron-builder handles signing itself, so this hook is skipped.
 */
exports.default = async function afterPack(context) {
    pruneChromiumLocales(context.appOutDir);

    if (context.electronPlatformName === 'linux') {
        pruneBetterSqlitePayload(context.appOutDir);
    }

    if (process.platform !== 'darwin') return;

    // Skip if a real signing identity is configured via electron-builder
    if (process.env.CSC_LINK || process.env.CSC_NAME) {
        console.log('afterPack: Skipping ad-hoc re-signing (CSC_LINK/CSC_NAME is set)');
        return;
    }

    const appName = context.packager.appInfo.productFilename;
    const appPath = path.join(context.appOutDir, `${appName}.app`);

    console.log(
        `afterPack: Re-signing "${appPath}" with ad-hoc identity for Team ID consistency...`,
    );

    execSync(
        `codesign --force --deep --sign - --entitlements "${path.resolve(__dirname, '../resources/entitlements.mac.plist')}" "${appPath}"`,
        { stdio: 'inherit' },
    );

    console.log('afterPack: Ad-hoc re-signing complete');
};
