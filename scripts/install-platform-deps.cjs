/**
 * Auto-detect and install platform-specific native dependencies.
 *
 * Scans all production dependencies for optionalDependencies that follow
 * platform-specific naming patterns. Installs only the packages matching
 * the current OS and architecture (auto-detected from process.platform/arch).
 *
 * For packages with GPU variants (e.g., node-llama-cpp), installs the
 * GPU-accelerated version (metal on macOS, plain on others) but excludes
 * CUDA/Vulkan variants that require separate driver installations.
 *
 * Usage:
 *   node scripts/install-platform-deps.cjs
 */

const { execSync } = require('child_process')
const { existsSync, readFileSync } = require('fs')
const { join } = require('path')

// ── Platform detection ───────────────────────────────────────────────────────

const TARGET_OS = process.platform   // 'linux', 'darwin', 'win32'
const TARGET_ARCH = process.arch     // 'x64', 'arm64'

// OS strings that appear in package names
const OS_ALIASES = {
  linux: ['linux'],
  darwin: ['darwin', 'mac'],
  win32: ['win32', 'win'],
}

// Arch strings that appear in package names
const ARCH_ALIASES = {
  x64: ['x64'],
  arm64: ['arm64'],
  arm: ['armv7l', 'arm'],
}

// Variants that require separate driver installations — always excluded
const EXCLUDED_VARIANTS = ['cuda', 'cuda-ext', 'vulkan']

// ── Matching logic ───────────────────────────────────────────────────────────

/**
 * Split a package name into segments for matching.
 * e.g. "@node-llama-cpp/mac-arm64-metal" -> ["node", "llama", "cpp", "mac", "arm64", "metal"]
 */
function getSegments(pkgName) {
  return pkgName.toLowerCase().replace(/@/g, '').split(/[-/]+/)
}

function matchesPlatform(pkgName) {
  const segments = getSegments(pkgName)

  // Exclude CUDA/Vulkan variants
  if (segments.some((s) => EXCLUDED_VARIANTS.includes(s))) return false

  const osAliases = OS_ALIASES[TARGET_OS] || [TARGET_OS]
  const archAliases = ARCH_ALIASES[TARGET_ARCH] || [TARGET_ARCH]

  // Must match the target OS (exact segment match — prevents "win" matching "darwin")
  const matchesOs = segments.some((s) => osAliases.includes(s))
  if (!matchesOs) return false

  // If the package name contains any arch segment, it must match ours
  const allArchStrings = Object.values(ARCH_ALIASES).flat()
  const hasArch = segments.some((s) => allArchStrings.includes(s))
  if (hasArch) {
    const matchesArch = segments.some((s) => archAliases.includes(s))
    if (!matchesArch) return false
  }

  return true
}

// ── Scan dependencies ────────────────────────────────────────────────────────

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function resolvePkgJson(dep) {
  // Try standard node_modules path
  const direct = join(process.cwd(), 'node_modules', dep, 'package.json')
  if (existsSync(direct)) return readJson(direct)

  // Try pnpm virtual store
  const pnpm = join(process.cwd(), 'node_modules', '.pnpm', 'node_modules', dep, 'package.json')
  if (existsSync(pnpm)) return readJson(pnpm)

  return null
}

function findPlatformDeps() {
  const rootPkg = readJson(join(process.cwd(), 'package.json'))
  if (!rootPkg) {
    console.error('Could not read package.json')
    process.exit(1)
  }

  const deps = Object.keys(rootPkg.dependencies || {})
  const toInstall = new Map()

  for (const dep of deps) {
    const depPkg = resolvePkgJson(dep)
    if (!depPkg?.optionalDependencies) continue

    for (const [optName, optVersion] of Object.entries(depPkg.optionalDependencies)) {
      if (matchesPlatform(optName)) {
        toInstall.set(optName, optVersion)
      }
    }
  }

  return toInstall
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\nDetecting platform-specific dependencies for ${TARGET_OS}-${TARGET_ARCH}...\n`)

  const toInstall = findPlatformDeps()

  if (toInstall.size === 0) {
    console.log('No platform-specific dependencies to install.')
    return
  }

  const packages = [...toInstall.entries()].map(([name, version]) => `${name}@${version}`)

  console.log('Platform-specific packages:')
  for (const pkg of packages) {
    console.log(`  + ${pkg}`)
  }

  // Check which are already installed
  const missing = packages.filter((pkg) => {
    const name = pkg.replace(/@[^@]+$/, '')
    return !existsSync(join(process.cwd(), 'node_modules', name, 'package.json'))
  })

  if (missing.length === 0) {
    console.log('\nAll platform-specific dependencies already installed.\n')
    return
  }

  console.log(`\nInstalling ${missing.length} package(s)...\n`)

  const cmd = `pnpm add ${missing.join(' ')}`
  console.log(`> ${cmd}\n`)

  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() })
    console.log('\nPlatform-specific dependencies installed.\n')
  } catch {
    console.error('\nFailed to install platform-specific dependencies.')
    process.exit(1)
  }
}

main()
