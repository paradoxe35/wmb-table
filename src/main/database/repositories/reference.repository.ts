import { getRefDb } from '../reference-db';
import type { RefLanguage, RefSermon, RefTranslator } from '@shared/types';

// WARNING:
// Do not use `isar_id` as an external or persisted reference.
//
// Why:
// - `isar_id` is an internal storage key from the upstream Isar database.
// - It is used here only to join tables inside the read-only reference DB.
// - It is not stable across upstream database rebuilds or releases.
// - The same `isar_id` can point to different content after regenerating
//   `resources/database/data.sqlite` from a newer `db.isar`.
//
// External app state must use stable business identifiers instead:
// - sermon: `sermon.id`
// - translator: `translator.translator_id`
// - language: `language.code`
//
// If new code needs a durable reference, do not add APIs or persisted fields
// keyed by `isar_id`.

// ---------------------------------------------------------------------------
// Row types (raw from SQLite)
// ---------------------------------------------------------------------------

interface LanguageRow {
    isar_id: number;
    code: string;
    title: string;
    native_title: string;
    audio_path: string;
    file_name: string;
    file_size: string;
    is_rtl: number;
    url: string;
    storage_bucket: string;
    translations_support: number;
    stemmers_supported: number;
}

interface SermonRow {
    isar_id: number;
    id: string;
    title: string;
    title_formatted: string;
    date_ms: number;
    minutes: number;
    location_name: string | null;
    city_name: string | null;
    state_abbr: string | null;
}

interface TranslatorRow {
    isar_id: number;
    translator_id: number;
    name: string;
    long_name: string;
}

export interface TranslationRow {
    translation_isar_id: number;
    title: string;
    title_formatted: string;
    sermon_isar_id: number;
    sermon_id: string;
    sermon_title: string;
    sermon_date_ms: number;
    sermon_minutes: number;
    location_name: string | null;
    city_name: string | null;
    state_abbr: string | null;
    translator_isar_id: number;
    translator_id: number;
    translator_name: string;
    translator_long_name: string;
    lang_code: string;
    audio_path: string;
    storage_bucket: string;
}

interface AudioRow {
    path: string;
    audio_path: string;
    storage_bucket: string;
}

interface AudioTitleRow extends AudioRow {
    sermon_id: string;
    audio_title: string | null;
}

export interface AudioTitleMap {
    exact: Map<string, string>;
    generic: Map<string, string>;
}

interface CrossLangTranslationRow {
    translation_id: number;
    lang_code: string;
    title: string;
    translator_name: string | null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function toRefLanguage(r: LanguageRow): RefLanguage {
    return {
        isarId: r.isar_id,
        code: r.code,
        title: r.title,
        nativeTitle: r.native_title,
        audioPath: r.audio_path,
        fileName: r.file_name,
        fileSize: r.file_size,
        isRtl: r.is_rtl === 1,
        url: r.url,
        storageBucket: r.storage_bucket,
        translationsSupport: r.translations_support === 1,
        stemmersSupported: r.stemmers_supported === 1,
    };
}

function toRefSermon(r: SermonRow): RefSermon {
    return {
        isarId: r.isar_id,
        id: r.id,
        title: r.title,
        titleFormatted: r.title_formatted,
        dateMs: r.date_ms,
        minutes: r.minutes,
        location: r.location_name,
        cityState: r.city_name
            ? r.state_abbr
                ? `${r.city_name}, ${r.state_abbr}`
                : r.city_name
            : null,
    };
}

function toRefTranslator(r: TranslatorRow): RefTranslator {
    return {
        isarId: r.isar_id,
        translatorId: r.translator_id,
        name: r.name,
        longName: r.long_name,
    };
}

// ---------------------------------------------------------------------------
// Language queries
// ---------------------------------------------------------------------------

export function getAllLanguages(): RefLanguage[] {
    const stmt = getRefDb().prepare(`SELECT * FROM language ORDER BY title`);
    return (stmt.all() as LanguageRow[]).map(toRefLanguage);
}

export function getLanguageByCode(code: string): RefLanguage | null {
    const stmt = getRefDb().prepare(`SELECT * FROM language WHERE code = ?`);
    const row = stmt.get(code) as LanguageRow | undefined;
    return row ? toRefLanguage(row) : null;
}

// ---------------------------------------------------------------------------
// Sermon queries
// ---------------------------------------------------------------------------

export function getAllSermons(): RefSermon[] {
    const stmt = getRefDb().prepare(`
        SELECT s.isar_id, s.id, s.title, s.title_formatted, s.date_ms, s.minutes,
               l.name as location_name,
               c.name as city_name,
               st.idx as state_abbr
        FROM sermon s
        LEFT JOIN location l ON s.location_id = l.isar_id
        LEFT JOIN city c ON l.city_id = c.isar_id
        LEFT JOIN state st ON c.state_id = st.isar_id
        ORDER BY s.date_ms
    `);
    return (stmt.all() as SermonRow[]).map(toRefSermon);
}

export function getSermonById(sermonId: string): RefSermon | null {
    const stmt = getRefDb().prepare(`
        SELECT s.isar_id, s.id, s.title, s.title_formatted, s.date_ms, s.minutes,
               l.name as location_name,
               c.name as city_name,
               st.idx as state_abbr
        FROM sermon s
        LEFT JOIN location l ON s.location_id = l.isar_id
        LEFT JOIN city c ON l.city_id = c.isar_id
        LEFT JOIN state st ON c.state_id = st.isar_id
        WHERE s.id = ?
    `);
    const row = stmt.get(sermonId) as SermonRow | undefined;
    return row ? toRefSermon(row) : null;
}

// ---------------------------------------------------------------------------
// Translation queries
// ---------------------------------------------------------------------------

export function getTranslationsForLanguage(langCode: string): TranslationRow[] {
    const stmt = getRefDb().prepare(`
        SELECT
            t.isar_id as translation_isar_id,
            t.title,
            t.title_formatted,
            s.isar_id as sermon_isar_id,
            s.id as sermon_id,
            s.title as sermon_title,
            s.date_ms as sermon_date_ms,
            s.minutes as sermon_minutes,
            l2.name as location_name,
            c.name as city_name,
            st.idx as state_abbr,
            tr.isar_id as translator_isar_id,
            tr.translator_id,
            tr.name as translator_name,
            tr.long_name as translator_long_name,
            lang.code as lang_code,
            lang.audio_path,
            lang.storage_bucket
        FROM translation t
        JOIN sermon s ON t.sermon_id = s.isar_id
        JOIN translator tr ON t.translator_id = tr.isar_id
        JOIN language lang ON t.language_id = lang.isar_id
        LEFT JOIN location l2 ON s.location_id = l2.isar_id
        LEFT JOIN city c ON l2.city_id = c.isar_id
        LEFT JOIN state st ON c.state_id = st.isar_id
        WHERE lang.code = ?
        ORDER BY s.date_ms DESC
    `);
    return stmt.all(langCode) as TranslationRow[];
}

export function getTranslationsForSermonAndLanguage(
    sermonId: string,
    langCode: string,
): TranslationRow[] {
    const stmt = getRefDb().prepare(`
        SELECT
            t.isar_id as translation_isar_id,
            t.title,
            t.title_formatted,
            s.isar_id as sermon_isar_id,
            s.id as sermon_id,
            s.title as sermon_title,
            s.date_ms as sermon_date_ms,
            s.minutes as sermon_minutes,
            l2.name as location_name,
            c.name as city_name,
            st.idx as state_abbr,
            tr.isar_id as translator_isar_id,
            tr.translator_id,
            tr.name as translator_name,
            tr.long_name as translator_long_name,
            lang.code as lang_code,
            lang.audio_path,
            lang.storage_bucket
        FROM translation t
        JOIN sermon s ON t.sermon_id = s.isar_id
        JOIN translator tr ON t.translator_id = tr.isar_id
        JOIN language lang ON t.language_id = lang.isar_id
        LEFT JOIN location l2 ON s.location_id = l2.isar_id
        LEFT JOIN city c ON l2.city_id = c.isar_id
        LEFT JOIN state st ON c.state_id = st.isar_id
        WHERE s.id = ? AND lang.code = ?
        ORDER BY tr.translator_id
    `);
    return stmt.all(sermonId, langCode) as TranslationRow[];
}

export function getTranslationsForSermon(sermonId: string): CrossLangTranslationRow[] {
    const stmt = getRefDb().prepare(`
        SELECT
            tr.translator_id as translation_id,
            lang.code as lang_code,
            t.title,
            tr.name as translator_name
        FROM translation t
        JOIN sermon s ON t.sermon_id = s.isar_id
        JOIN translator tr ON t.translator_id = tr.isar_id
        JOIN language lang ON t.language_id = lang.isar_id
        WHERE s.id = ?
        ORDER BY lang.title, tr.translator_id
    `);
    return stmt.all(sermonId) as CrossLangTranslationRow[];
}

export function getTranslationCountForLanguage(langCode: string): number {
    const stmt = getRefDb().prepare(`
        SELECT COUNT(*) as cnt
        FROM translation t
        JOIN language lang ON t.language_id = lang.isar_id
        WHERE lang.code = ?
    `);
    const row = stmt.get(langCode) as { cnt: number };
    return row.cnt;
}

// ---------------------------------------------------------------------------
// Translator queries
// ---------------------------------------------------------------------------

export function getTranslatorsForLanguage(langCode: string): RefTranslator[] {
    const stmt = getRefDb().prepare(`
        SELECT tr.isar_id, tr.translator_id, tr.name, tr.long_name
        FROM translator tr
        JOIN language lang ON tr.language_id = lang.isar_id
        WHERE lang.code = ?
        ORDER BY tr.translator_id
    `);
    return (stmt.all(langCode) as TranslatorRow[]).map(toRefTranslator);
}

// ---------------------------------------------------------------------------
// Audio queries
// ---------------------------------------------------------------------------

function buildAudioUrl(row: AudioRow): string {
    const encodedPath = row.path
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
    return `https://s3.eu-central-1.wasabisys.com/${row.storage_bucket}/${row.audio_path}${encodedPath}`;
}

function makeAudioTitleKey(sermonId: string, audioTitle: string): string {
    return `${sermonId}\u0000${audioTitle}`;
}

export function getAudioFromTitleMap(
    map: AudioTitleMap,
    sermonId: string,
    translatorName: string,
): string | null {
    return (
        map.exact.get(makeAudioTitleKey(sermonId, translatorName)) ??
        map.generic.get(sermonId) ??
        null
    );
}

export function getAudioForSermon(sermonIsarId: number, langIsarId: number): AudioRow[] {
    const stmt = getRefDb().prepare(`
        SELECT a.path, lang.audio_path, lang.storage_bucket
        FROM audio a
        JOIN language lang ON a.language_id = lang.isar_id
        WHERE a.sermon_id = ? AND a.language_id = ?
    `);
    return stmt.all(sermonIsarId, langIsarId) as AudioRow[];
}

export function getAudioForSermonByIds(sermonId: string, langCode: string): string | null {
    const stmt = getRefDb().prepare(`
        SELECT a.path, lang.audio_path, lang.storage_bucket
        FROM audio a
        JOIN sermon s ON a.sermon_id = s.isar_id
        JOIN language lang ON a.language_id = lang.isar_id
        WHERE s.id = ? AND lang.code = ?
        LIMIT 1
    `);
    const row = stmt.get(sermonId, langCode) as AudioRow | undefined;
    if (!row) return null;
    return buildAudioUrl(row);
}

export function getAudioForTranslationByIds(
    sermonId: string,
    langCode: string,
    translatorName: string,
): string | null {
    const stmt = getRefDb().prepare(`
        SELECT a.path, lang.audio_path, lang.storage_bucket
        FROM audio a
        JOIN sermon s ON a.sermon_id = s.isar_id
        JOIN language lang ON a.language_id = lang.isar_id
        LEFT JOIN audio_title at ON a.title_id = at.isar_id
        WHERE s.id = ?
          AND lang.code = ?
          AND (at.value = ? OR a.title_id IS NULL)
        ORDER BY CASE WHEN at.value = ? THEN 0 ELSE 1 END, a.isar_id
        LIMIT 1
    `);
    const row = stmt.get(sermonId, langCode, translatorName, translatorName) as
        | AudioRow
        | undefined;
    if (!row) return null;
    return buildAudioUrl(row);
}

/**
 * Batch lookup: returns a Map of sermonId → audio URL for all sermons in a language.
 * Single query replaces N individual getAudioForSermonByIds calls.
 */
export function getAudioMapForLanguage(langCode: string): Map<string, string> {
    const stmt = getRefDb().prepare(`
        SELECT s.id as sermon_id, a.path, lang.audio_path, lang.storage_bucket
        FROM audio a
        JOIN sermon s ON a.sermon_id = s.isar_id
        JOIN language lang ON a.language_id = lang.isar_id
        WHERE lang.code = ?
    `);
    const rows = stmt.all(langCode) as (AudioRow & { sermon_id: string })[];
    const map = new Map<string, string>();
    for (const row of rows) {
        // Keep first match per sermon (same as LIMIT 1 behavior in single lookup)
        if (!map.has(row.sermon_id)) {
            map.set(row.sermon_id, buildAudioUrl(row));
        }
    }
    return map;
}

export function getAudioTitleMapForLanguage(langCode: string): AudioTitleMap {
    const stmt = getRefDb().prepare(`
        SELECT s.id as sermon_id,
               at.value as audio_title,
               a.path,
               lang.audio_path,
               lang.storage_bucket
        FROM audio a
        JOIN sermon s ON a.sermon_id = s.isar_id
        JOIN language lang ON a.language_id = lang.isar_id
        LEFT JOIN audio_title at ON a.title_id = at.isar_id
        WHERE lang.code = ?
        ORDER BY a.isar_id
    `);
    const rows = stmt.all(langCode) as AudioTitleRow[];
    const exact = new Map<string, string>();
    const generic = new Map<string, string>();
    for (const row of rows) {
        if (row.audio_title) {
            const key = makeAudioTitleKey(row.sermon_id, row.audio_title);
            if (!exact.has(key)) {
                exact.set(key, buildAudioUrl(row));
            }
            continue;
        }

        if (!generic.has(row.sermon_id)) {
            generic.set(row.sermon_id, buildAudioUrl(row));
        }
    }
    return { exact, generic };
}

export function getAudioSermonIdsForLanguage(langCode: string): Set<string> {
    const stmt = getRefDb().prepare(`
        SELECT DISTINCT s.id as sermon_id
        FROM audio a
        JOIN sermon s ON a.sermon_id = s.isar_id
        JOIN language lang ON a.language_id = lang.isar_id
        WHERE lang.code = ?
    `);
    const rows = stmt.all(langCode) as { sermon_id: string }[];
    return new Set(rows.map((row) => row.sermon_id));
}

export function getAudioCountForLanguage(langCode: string): number {
    const stmt = getRefDb().prepare(`
        SELECT COUNT(*) as cnt
        FROM audio a
        JOIN language lang ON a.language_id = lang.isar_id
        WHERE lang.code = ?
    `);
    const row = stmt.get(langCode) as { cnt: number };
    return row.cnt;
}

// ---------------------------------------------------------------------------
// Single-sermon translation lookup
// ---------------------------------------------------------------------------

interface TranslationJoinedRow {
    title: string;
    sermon_id: string;
    translator_id: number;
    translator_name: string;
    sermon_title: string;
    sermon_date_ms: number;
    sermon_minutes: number;
    location_name: string | null;
    city_name: string | null;
    state_abbr: string | null;
}

export function getTranslationByIds(
    translatorId: number,
    sermonId: string,
    langCode: string,
): TranslationJoinedRow | null {
    const stmt = getRefDb().prepare(`
        SELECT t.title, s.id as sermon_id, tr.translator_id, tr.name as translator_name,
               s.title as sermon_title, s.date_ms as sermon_date_ms,
               s.minutes as sermon_minutes, l2.name as location_name,
               c.name as city_name, st.idx as state_abbr
        FROM translation t
        JOIN translator tr ON t.translator_id = tr.isar_id
        JOIN language lang ON t.language_id = lang.isar_id
        JOIN sermon s ON t.sermon_id = s.isar_id
        LEFT JOIN location l2 ON s.location_id = l2.isar_id
        LEFT JOIN city c ON l2.city_id = c.isar_id
        LEFT JOIN state st ON c.state_id = st.isar_id
        WHERE tr.translator_id = ? AND s.id = ? AND lang.code = ?
        LIMIT 1
    `);
    return (stmt.get(translatorId, sermonId, langCode) as TranslationJoinedRow) ?? null;
}

// ---------------------------------------------------------------------------
// Deduplicated sermon count
// ---------------------------------------------------------------------------

export function getUniqueSermonCountForLanguage(langCode: string): number {
    const stmt = getRefDb().prepare(`
        SELECT COUNT(DISTINCT t.sermon_id) as cnt
        FROM translation t
        JOIN language lang ON t.language_id = lang.isar_id
        WHERE lang.code = ?
    `);
    const row = stmt.get(langCode) as { cnt: number };
    return row.cnt;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/**
 * Convert sermon.id (e.g. "53-0403", "65-1128M") to Tantivy sermon_date number.
 * Strips the dash and any trailing letter suffix.
 * "53-0403" → 530403, "65-1128M" → 651128
 */
export function sermonIdToTantivyDate(sermonId: string): number {
    const stripped = sermonId.replace(/-/g, '').replace(/[A-Za-z]+$/, '');
    return parseInt(stripped, 10);
}

/**
 * Reverse lookup: Tantivy sermon_date (epoch ms) → sermon IDs.
 * The Tantivy index stores sermon_date as epoch milliseconds (same as sermon.date_ms).
 */
export function tantivyDateToSermonIds(dateMs: number): string[] {
    const stmt = getRefDb().prepare(`SELECT id FROM sermon WHERE date_ms = ?`);
    const rows = stmt.all(dateMs) as { id: string }[];
    return rows.map((r) => r.id);
}

/**
 * Batch reverse lookup: multiple Tantivy dates → Map<dateMs, sermonIds>.
 * Single query replaces N individual tantivyDateToSermonIds calls.
 */
export function tantivyDatesToSermonIds(dateMsArray: number[]): Map<number, string[]> {
    if (dateMsArray.length === 0) return new Map();
    const placeholders = dateMsArray.map(() => '?').join(',');
    const stmt = getRefDb().prepare(
        `SELECT id, date_ms FROM sermon WHERE date_ms IN (${placeholders})`,
    );
    const rows = stmt.all(...dateMsArray) as { id: string; date_ms: number }[];
    const map = new Map<number, string[]>();
    for (const row of rows) {
        const existing = map.get(row.date_ms);
        if (existing) {
            existing.push(row.id);
        } else {
            map.set(row.date_ms, [row.id]);
        }
    }
    return map;
}
