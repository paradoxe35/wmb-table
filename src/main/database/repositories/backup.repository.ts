import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { backupStatus, backupDbReferences } from '../schema';
import type { BackupStatus, BackupDbReference } from '@shared/types';

const STATUS_ID = 'backup-status-singleton';

export function getStatus(): BackupStatus | null {
    const row = getDb().select().from(backupStatus).get();
    if (!row) return null;
    return {
        id: row.id,
        email: row.email,
        name: row.name,
        active: row.active,
        access: row.access,
        restored: row.restored,
        lastUpdate: new Date(row.lastUpdate ?? Date.now()),
    };
}

export function toggleStatus(active: boolean): void {
    const db = getDb();
    const existing = db.select().from(backupStatus).get();
    if (existing) {
        db.update(backupStatus)
            .set({ active, lastUpdate: new Date().toISOString() })
            .where(eq(backupStatus.id, existing.id))
            .run();
    }
}

export function upsertStatus(data: Omit<BackupStatus, 'id'>): BackupStatus {
    const db = getDb();
    const existing = db.select().from(backupStatus).get();
    const now = new Date().toISOString();
    if (existing) {
        db.update(backupStatus)
            .set({
                email: data.email,
                name: data.name,
                active: data.active,
                access: data.access,
                restored: data.restored,
                lastUpdate: now,
            })
            .where(eq(backupStatus.id, existing.id))
            .run();
        return getStatus()!;
    } else {
        const id = STATUS_ID;
        db.insert(backupStatus)
            .values({
                id,
                email: data.email,
                name: data.name,
                active: data.active,
                access: data.access,
                restored: data.restored,
                lastUpdate: now,
            })
            .run();
        return getStatus()!;
    }
}

export function deleteStatus(): void {
    getDb().delete(backupStatus).run();
}

export function getReminder(): boolean {
    const status = getStatus();
    if (!status || !status.active) return false;
    // Check if last backup was more than 7 days ago
    const lastUpdate = status.lastUpdate.getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - lastUpdate > sevenDays;
}

export function getDbReferences(): BackupDbReference[] {
    return getDb()
        .select()
        .from(backupDbReferences)
        .all()
        .map((row) => ({
            id: row.id,
            filename: row.filename,
            lines: row.lines,
        }));
}

export function upsertDbReference(filename: string, lines: string): BackupDbReference {
    const db = getDb();
    const existing = db
        .select()
        .from(backupDbReferences)
        .where(eq(backupDbReferences.filename, filename))
        .get();
    if (existing) {
        db.update(backupDbReferences)
            .set({ lines })
            .where(eq(backupDbReferences.id, existing.id))
            .run();
        return { id: existing.id, filename, lines };
    }
    const id = randomUUID();
    db.insert(backupDbReferences).values({ id, filename, lines }).run();
    return { id, filename, lines };
}

export function deleteDbReference(id: string): void {
    getDb().delete(backupDbReferences).where(eq(backupDbReferences.id, id)).run();
}
