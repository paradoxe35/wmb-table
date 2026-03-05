import { google, type drive_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { Readable } from 'node:stream';
import log from 'electron-log';
import type { ChangeLogRecord } from './change-log.service';

export interface DriveFile {
    id: string;
    name: string;
    createdTime: string;
}

export class GoogleDriveService {
    private drive: drive_v3.Drive;

    constructor(authClient: OAuth2Client) {
        this.drive = google.drive({
            version: 'v3',
            auth: authClient,
            timeout: 30_000,
            retry: true,
        });
    }

    // -----------------------------------------------------------------------
    // Snapshots
    // -----------------------------------------------------------------------

    async getLatestSnapshot(): Promise<DriveFile | null> {
        const res = await this.drive.files.list({
            spaces: 'appDataFolder',
            q: "name contains 'snapshot_' and trashed = false",
            fields: 'files(id, name, createdTime)',
            orderBy: 'createdTime desc',
            pageSize: 1,
        });
        const file = res.data.files?.[0];
        if (!file?.id || !file.name || !file.createdTime) return null;
        return { id: file.id, name: file.name, createdTime: file.createdTime };
    }

    async saveSnapshot(content: Buffer): Promise<DriveFile> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const name = `snapshot_${timestamp}.db.gz`;

        const res = await this.drive.files.create({
            requestBody: {
                name,
                parents: ['appDataFolder'],
            },
            media: {
                mimeType: 'application/gzip',
                body: Readable.from(content),
            },
            fields: 'id, name, createdTime',
        });

        return {
            id: res.data.id!,
            name: res.data.name!,
            createdTime: res.data.createdTime!,
        };
    }

    // -----------------------------------------------------------------------
    // Change logs
    // -----------------------------------------------------------------------

    async uploadChangeLog(change: ChangeLogRecord): Promise<DriveFile> {
        const name = `changes_${change.changeId}.json`;
        const body = JSON.stringify({
            changeId: change.changeId,
            tableName: change.tableName,
            rowId: change.rowId,
            operation: change.operation,
            newData: change.newData,
        });

        const res = await this.drive.files.create({
            requestBody: {
                name,
                parents: ['appDataFolder'],
            },
            media: {
                mimeType: 'application/json',
                body: Readable.from(body),
            },
            fields: 'id, name, createdTime',
        });

        return {
            id: res.data.id!,
            name: res.data.name!,
            createdTime: res.data.createdTime!,
        };
    }

    async getChangesAfterTimeOffset(timeOffset: string): Promise<DriveFile[]> {
        const files: DriveFile[] = [];
        let pageToken: string | undefined;

        do {
            const res = await this.drive.files.list({
                spaces: 'appDataFolder',
                q: `name contains 'changes_' and createdTime > '${timeOffset}' and trashed = false`,
                fields: 'nextPageToken, files(id, name, createdTime)',
                orderBy: 'createdTime asc',
                pageSize: 100,
                pageToken,
            });

            for (const file of res.data.files ?? []) {
                if (file.id && file.name && file.createdTime) {
                    files.push({ id: file.id, name: file.name, createdTime: file.createdTime });
                }
            }
            pageToken = res.data.nextPageToken ?? undefined;
        } while (pageToken);

        return files;
    }

    async deleteChangeLog(changeId: string): Promise<DriveFile[]> {
        const res = await this.drive.files.list({
            spaces: 'appDataFolder',
            q: `name = 'changes_${changeId}.json' and trashed = false`,
            fields: 'files(id, name, createdTime)',
        });

        const deleted: DriveFile[] = [];
        for (const file of res.data.files ?? []) {
            if (file.id) {
                await this.drive.files.delete({ fileId: file.id });
                deleted.push({
                    id: file.id,
                    name: file.name ?? '',
                    createdTime: file.createdTime ?? '',
                });
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

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    async pruneOldChanges(before: string): Promise<void> {
        let pageToken: string | undefined;

        do {
            const res = await this.drive.files.list({
                spaces: 'appDataFolder',
                q: `name contains 'changes_' and createdTime < '${before}' and trashed = false`,
                fields: 'nextPageToken, files(id)',
                pageSize: 100,
                pageToken,
            });

            for (const file of res.data.files ?? []) {
                if (file.id) {
                    try {
                        await this.drive.files.delete({ fileId: file.id });
                    } catch (err) {
                        log.warn(`Failed to prune change file ${file.id}:`, err);
                    }
                }
            }
            pageToken = res.data.nextPageToken ?? undefined;
        } while (pageToken);
    }

    async pruneOldSnapshots(keepCount: number = 2): Promise<void> {
        const res = await this.drive.files.list({
            spaces: 'appDataFolder',
            q: "name contains 'snapshot_' and trashed = false",
            fields: 'files(id, name, createdTime)',
            orderBy: 'createdTime desc',
            pageSize: 100,
        });

        const files = res.data.files ?? [];
        for (let i = keepCount; i < files.length; i++) {
            const file = files[i];
            if (file.id) {
                try {
                    await this.drive.files.delete({ fileId: file.id });
                } catch (err) {
                    log.warn(`Failed to prune snapshot ${file.id}:`, err);
                }
            }
        }
    }
}
