import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { access, copyFile, rename, rm, stat, writeFile } from 'node:fs/promises';

export function backupPathFor(path: string, now: Date): string {
    return `${path}.wmb-table-backup-${now.toISOString().replace(/[:.]/g, '-')}`;
}

async function existingMode(path: string): Promise<number | null> {
    try {
        return (await stat(path)).mode & 0o777;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
    }
}

/**
 * Copies the current file aside, then replaces it in one rename, so the other app never reads a
 * half-written file. A read-only file is refused here: the rename alone would bypass it.
 */
export async function writeConfigSafely(
    path: string,
    text: string,
    now: Date,
): Promise<{ backupPath: string | null }> {
    const mode = await existingMode(path);
    let backupPath: string | null = null;
    if (mode !== null) {
        await access(path, constants.W_OK);
        backupPath = backupPathFor(path, now);
        await copyFile(path, backupPath, constants.COPYFILE_EXCL);
    }
    const tempPath = `${path}.wmb-table-${randomBytes(6).toString('hex')}.tmp`;
    try {
        await writeFile(tempPath, text, { mode: mode ?? 0o644, flag: 'wx' });
        await rename(tempPath, path);
    } catch (error) {
        await rm(tempPath, { force: true });
        throw error;
    }
    return { backupPath };
}

export async function isDirectory(path: string): Promise<boolean> {
    try {
        return (await stat(path)).isDirectory();
    } catch {
        return false;
    }
}

export function isPermissionError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    return code === 'EACCES' || code === 'EPERM' || code === 'EROFS';
}
