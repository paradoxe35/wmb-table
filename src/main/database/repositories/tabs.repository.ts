import { eq } from 'drizzle-orm';
import log from 'electron-log';
import { getDb } from '../index';
import { tabs } from '../schema';
import type { DocumentTab } from '@shared/types';

export function getTabs(languageCode: string): DocumentTab[] {
    const row = getDb().select().from(tabs).where(eq(tabs.languageCode, languageCode)).get();
    if (!row) return [];
    try {
        return JSON.parse(row.datas);
    } catch (err) {
        log.warn('JSON parse failed in tabs repository:', err);
        return [];
    }
}

export function saveTabs(languageCode: string, datas: DocumentTab[]): void {
    const db = getDb();
    const existing = db.select().from(tabs).where(eq(tabs.languageCode, languageCode)).get();
    if (existing) {
        db.update(tabs)
            .set({ datas: JSON.stringify(datas) })
            .where(eq(tabs.id, existing.id))
            .run();
    } else {
        db.insert(tabs)
            .values({
                id: `tabs-${languageCode}`,
                languageCode,
                datas: JSON.stringify(datas),
            })
            .run();
    }
}
