import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { getDb } from '../index';
import { audioDocumentTimes, audioDownloads, audioDocumentLastPlay } from '../schema';
import type {
    AudioDocumentTime,
    AudioDocumentDownload,
    AudioDocumentPlayRequest,
} from '@shared/types';
import { parseJsonOrFallback } from '@main/lib/json';

const LAST_PLAY_ID = 'last-play-singleton';

export function getTimeByAudioLink(audioLink: string): AudioDocumentTime | null {
    const row = getDb()
        .select()
        .from(audioDocumentTimes)
        .where(eq(audioDocumentTimes.audioLink, audioLink))
        .get();
    if (!row) return null;
    return {
        id: row.id,
        audio_link: row.audioLink,
        time: row.time,
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    };
}

export function setTime(audioLink: string, time: number): void {
    const db = getDb();
    const now = new Date().toISOString();
    const id = randomUUID();
    db.insert(audioDocumentTimes)
        .values({ id, audioLink, time, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
            target: audioDocumentTimes.audioLink,
            set: { time, updatedAt: now },
        })
        .run();
}

export function getDownloadByAudioLink(audioLink: string): AudioDocumentDownload | null {
    const row = getDb()
        .select()
        .from(audioDownloads)
        .where(eq(audioDownloads.audioLink, audioLink))
        .get();
    if (!row) return null;

    // Verify the cached file still exists on disk
    if (row.localFile && !existsSync(row.localFile)) {
        getDb().delete(audioDownloads).where(eq(audioDownloads.audioLink, audioLink)).run();
        return null;
    }

    return {
        id: row.id,
        local_file: row.localFile ?? undefined,
        audio_link: row.audioLink,
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    };
}

export function setDownload(audioLink: string, localFile: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    const id = randomUUID();
    db.insert(audioDownloads)
        .values({ id, audioLink, localFile, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
            target: audioDownloads.audioLink,
            set: { localFile, updatedAt: now },
        })
        .run();
}

export function getLastPlay(): AudioDocumentPlayRequest | null {
    const row = getDb().select().from(audioDocumentLastPlay).get();
    if (!row || !row.doc) return null;
    return parseJsonOrFallback<AudioDocumentPlayRequest | null>(row.doc, null, {
        scope: 'audio_document_last_play',
        field: 'doc',
    });
}

export function setLastPlay(request: AudioDocumentPlayRequest): void {
    const db = getDb();
    const existing = db.select().from(audioDocumentLastPlay).get();
    const docJson = JSON.stringify(request);
    if (existing) {
        db.update(audioDocumentLastPlay)
            .set({ doc: docJson, reference: '' })
            .where(eq(audioDocumentLastPlay.id, existing.id))
            .run();
    } else {
        db.insert(audioDocumentLastPlay)
            .values({ id: LAST_PLAY_ID, doc: docJson, reference: '' })
            .run();
    }
}
