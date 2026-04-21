import { drive, type drive_v3 } from '@googleapis/drive';
import type { OAuth2Client } from 'google-auth-library';
import { Readable } from 'node:stream';
import log from 'electron-log';
import type { ChangeLogRecord } from './change-log.service';

const PARENT_FOLDER = 'appDataFolder';
export const DB_SNAPSHOT_PREFIX = 'snapshot_';
export const CHANGES_FILE_PREFIX = 'changes_';

export interface DriveFile {
    id: string;
    name: string;
    isSnapshot: boolean;
    createdTime: string;
}

export class GoogleDriveService {
    private drive: drive_v3.Drive;

    constructor(authClient: OAuth2Client) {
        this.drive = drive({
            version: 'v3',
            auth: authClient,
            timeout: 30_000,
            retry: true,
        });
    }

    private toDriveFile(file: drive_v3.Schema$File): DriveFile | null {
        if (!file.id || !file.name || !file.createdTime) return null;
        return {
            id: file.id,
            name: file.name,
            isSnapshot: file.name.startsWith(DB_SNAPSHOT_PREFIX),
            createdTime: file.createdTime,
        };
    }

    // -----------------------------------------------------------------------
    // Snapshots
    // -----------------------------------------------------------------------

    async getLatestSnapshot(): Promise<DriveFile | null> {
        const res = await this.drive.files.list({
            spaces: PARENT_FOLDER,
            q: `name contains '${DB_SNAPSHOT_PREFIX}' and trashed = false`,
            fields: 'files(id, name, createdTime)',
            orderBy: 'createdTime desc',
            pageSize: 1,
        });
        const file = res.data.files?.[0];
        return file ? this.toDriveFile(file) : null;
    }

    async saveSnapshot(content: NodeJS.ReadableStream): Promise<DriveFile> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const name = `${DB_SNAPSHOT_PREFIX}${timestamp}.db.gz`;

        const res = await this.drive.files.create({
            requestBody: { name, parents: [PARENT_FOLDER] },
            media: { mimeType: 'application/gzip', body: content },
            fields: 'id, name, createdTime',
        });

        return {
            id: res.data.id!,
            name: res.data.name!,
            isSnapshot: true,
            createdTime: res.data.createdTime!,
        };
    }

    // -----------------------------------------------------------------------
    // Change files — returns ALL files (snapshots + changes) after offset
    // -----------------------------------------------------------------------

    async getChangeFilesAfterTimeOffset(timeOffset: string): Promise<DriveFile[]> {
        const files: DriveFile[] = [];
        let pageToken: string | undefined;

        do {
            const res = await this.drive.files.list({
                spaces: PARENT_FOLDER,
                q: `createdTime > '${timeOffset}' and trashed = false`,
                fields: 'nextPageToken, files(id, name, createdTime)',
                orderBy: 'createdTime asc',
                pageSize: 100,
                pageToken,
            });

            for (const file of res.data.files ?? []) {
                const df = this.toDriveFile(file);
                if (df && df.createdTime > timeOffset) {
                    files.push(df);
                }
            }
            pageToken = res.data.nextPageToken ?? undefined;
        } while (pageToken);

        return files;
    }

    // -----------------------------------------------------------------------
    // Upload / Delete change logs
    // -----------------------------------------------------------------------

    async uploadChangeLog(change: ChangeLogRecord): Promise<DriveFile> {
        const name = `${CHANGES_FILE_PREFIX}${change.changeId}.json`;
        const body = JSON.stringify({
            changeId: change.changeId,
            tableName: change.tableName,
            rowId: change.rowId,
            operation: change.operation,
            newData: change.newData,
        });

        const res = await this.drive.files.create({
            requestBody: { name, parents: [PARENT_FOLDER] },
            media: { mimeType: 'application/json', body: Readable.from(body) },
            fields: 'id, name, createdTime',
        });

        return {
            id: res.data.id!,
            name: res.data.name!,
            isSnapshot: false,
            createdTime: res.data.createdTime!,
        };
    }

    async deleteChangeLog(changeId: string): Promise<DriveFile[]> {
        const exactName = `${CHANGES_FILE_PREFIX}${changeId}.json`;
        const res = await this.drive.files.list({
            spaces: PARENT_FOLDER,
            q: `name = '${exactName}' and trashed = false`,
            fields: 'files(id, name, createdTime)',
        });

        const deleted: DriveFile[] = [];
        for (const file of res.data.files ?? []) {
            if (file.id) {
                try {
                    await this.drive.files.delete({ fileId: file.id });
                    const df = this.toDriveFile(file);
                    if (df) deleted.push(df);
                } catch (err) {
                    log.warn(`Failed to delete change file ${file.name}:`, err);
                }
            }
        }
        return deleted;
    }

    // -----------------------------------------------------------------------
    // Content
    // -----------------------------------------------------------------------

    async getFileContent(fileId: string): Promise<Buffer> {
        const res = await this.drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'arraybuffer' },
        );
        return Buffer.from(res.data as ArrayBuffer);
    }

    async getFileStream(fileId: string): Promise<NodeJS.ReadableStream> {
        const res = await this.drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' },
        );
        return res.data as NodeJS.ReadableStream;
    }

    // -----------------------------------------------------------------------
    // Cleanup — prunes ALL files (snapshots + changes) older than timestamp
    // -----------------------------------------------------------------------

    /**
     * Prune files with concurrency limit of 20.
     */
    async pruneOldChanges(before: string): Promise<void> {
        let pageToken: string | undefined;

        do {
            const res = await this.drive.files.list({
                spaces: PARENT_FOLDER,
                q: `createdTime < '${before}' and trashed = false`,
                fields: 'nextPageToken, files(id, name, createdTime)',
                pageSize: 100,
                pageToken,
            });

            const filesToDelete = (res.data.files ?? []).filter(
                (f) => f.id && f.createdTime && f.createdTime < before,
            );

            // Process in batches of 20 to limit concurrency
            const CONCURRENCY = 20;
            for (let i = 0; i < filesToDelete.length; i += CONCURRENCY) {
                const batch = filesToDelete.slice(i, i + CONCURRENCY);
                await Promise.all(
                    batch.map((file) =>
                        this.drive.files
                            .delete({ fileId: file.id! })
                            .then(() => {
                                log.debug(`Pruned file ${file.name}`);
                            })
                            .catch((err) => {
                                log.warn(`Failed to prune file ${file.id}:`, err);
                            }),
                    ),
                );
            }

            pageToken = res.data.nextPageToken ?? undefined;
        } while (pageToken);
    }
}
