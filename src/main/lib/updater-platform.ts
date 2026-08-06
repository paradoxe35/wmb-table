import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** electron-builder writes this marker only for targets that can self-install */
const SELF_UPDATING_LINUX_PACKAGES = new Set(['deb', 'rpm', 'pacman']);

let linuxPackageType: string | null | undefined;

/** Reads the same marker electron-updater uses to pick its updater implementation */
function getLinuxPackageType(): string | null {
    if (linuxPackageType !== undefined) return linuxPackageType;
    try {
        const marker = join(process.resourcesPath, 'package-type');
        linuxPackageType = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : null;
    } catch {
        linuxPackageType = null;
    }
    return linuxPackageType;
}

function isSelfUpdatingLinuxPackage(): boolean {
    const packageType = getLinuxPackageType();
    return packageType != null && SELF_UPDATING_LINUX_PACKAGES.has(packageType);
}

export function canAutoUpdate(): boolean {
    if (process.platform !== 'linux') return true;
    if (process.env.APPIMAGE) return true;
    return isSelfUpdatingLinuxPackage();
}

/** deb/rpm/pacman install through the system package manager, via pkexec/sudo */
export function requiresElevatedInstall(): boolean {
    if (process.platform !== 'linux' || process.env.APPIMAGE) return false;
    return isSelfUpdatingLinuxPackage();
}
