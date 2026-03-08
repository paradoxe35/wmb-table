const { execSync } = require('child_process')
const path = require('path')

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
  if (process.platform !== 'darwin') return

  // Skip if a real signing identity is configured via electron-builder
  if (process.env.CSC_LINK || process.env.CSC_NAME) {
    console.log('afterPack: Skipping ad-hoc re-signing (CSC_LINK/CSC_NAME is set)')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)

  console.log(`afterPack: Re-signing "${appPath}" with ad-hoc identity for Team ID consistency...`)

  execSync(
    `codesign --force --deep --sign - --entitlements "${path.resolve(__dirname, '../resources/entitlements.mac.plist')}" "${appPath}"`,
    { stdio: 'inherit' }
  )

  console.log('afterPack: Ad-hoc re-signing complete')
}
