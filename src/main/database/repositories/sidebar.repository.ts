import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { sidebarStatus } from '../schema';
import type { SidebarStatus } from '@shared/types';

const SINGLE_ROW_ID = 'sidebar-singleton';

export function getSidebarStatus(): SidebarStatus | null {
    const row = getDb().select().from(sidebarStatus).get();
    if (!row) return null;
    return {
        id: row.id,
        hidden: row.hidden,
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    };
}

export function setSidebarStatus(hidden: boolean): void {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = db.select().from(sidebarStatus).get();
    if (existing) {
        db.update(sidebarStatus)
            .set({ hidden, updatedAt: now })
            .where(eq(sidebarStatus.id, existing.id))
            .run();
    } else {
        db.insert(sidebarStatus)
            .values({ id: SINGLE_ROW_ID, hidden, createdAt: now, updatedAt: now })
            .run();
    }
}
