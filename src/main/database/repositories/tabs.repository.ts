import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { tabs } from '../schema';
import type { DocumentTab } from '@shared/types';

const SINGLE_ROW_ID = 'tabs-singleton';

export function getTabs(): DocumentTab[] {
    const row = getDb().select().from(tabs).get();
    if (!row) return [];
    return JSON.parse(row.datas);
}

export function saveTabs(datas: DocumentTab[]): void {
    const db = getDb();
    const existing = db.select().from(tabs).get();
    if (existing) {
        db.update(tabs)
            .set({ datas: JSON.stringify(datas) })
            .where(eq(tabs.id, existing.id))
            .run();
    } else {
        db.insert(tabs)
            .values({ id: SINGLE_ROW_ID, datas: JSON.stringify(datas) })
            .run();
    }
}
