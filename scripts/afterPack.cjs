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
 * Sign the whole .app bundle, always. Unsigned, Apple Silicon reports it as damaged and gives
 * no way past; on macOS 26+ dyld also refuses a bundle whose binaries disagree on Team ID.
 *
 * Signed here rather than by electron-builder, which skips signing when it finds only a
 * self-signed identity (`CSSMERR_TP_NOT_TRUSTED`) — `codesign` accepts one. Without a
 * certificate this falls back to ad-hoc, which launches but pins the cdhash, so Squirrel.Mac
 * rejects every update. See .github/variables.md
 */
exports.default = async function afterPack(context) {
    pruneChromiumLocales(context.appOutDir);

    if (context.electronPlatformName === 'linux') {
        pruneBetterSqlitePayload(context.appOutDir);
    }

    if (process.platform !== 'darwin') return;

    const appName = context.packager.appInfo.productFilename;
    const appPath = path.join(context.appOutDir, `${appName}.app`);
    const entitlements = path.resolve(__dirname, '../resources/entitlements.mac.plist');

    const identity = process.env.MAC_SIGN_IDENTITY;
    const keychain = process.env.MAC_SIGN_KEYCHAIN;
    const signWith = identity ? `--sign "${identity}"` : '--sign -';
    const fromKeychain = identity && keychain ? ` --keychain "${keychain}"` : '';

    console.log(`afterPack: signing "${appPath}" as ${identity ? `"${identity}"` : 'ad-hoc'}`);

    execSync(
        `codesign --force --deep ${signWith}${fromKeychain} --entitlements "${entitlements}" "${appPath}"`,
        { stdio: 'inherit' },
    );

    // Fail the release rather than publish a bundle macOS will refuse to open.
    execSync(`codesign --verify --deep --strict --verbose=2 "${appPath}"`, { stdio: 'inherit' });

    console.log('afterPack: signature verified');
};
