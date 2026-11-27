import { beforeEach, describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { createTestDb } from '../../database/test-helpers';
import { kvCache } from '@main/database/schema';
import { SYNCED_TABLE_NAMES } from '@main/database/sync-tables';
import * as kvRepo from '@main/database/repositories/kv-cache.repository';
import {
    MCP_SETTINGS_KEY,
    loadMcpSettings,
    saveMcpSettings,
} from '@main/services/mcp/mcp-settings';
import { DEFAULT_MCP_SERVER_SETTINGS } from '@shared/mcp.types';

let db: ReturnType<typeof createTestDb>;

beforeEach(() => {
    db = createTestDb();
});

describe('MCP server settings', () => {
    it('are off by default, with writes off, on the default port', () => {
        expect(loadMcpSettings()).toEqual({ enabled: false, allowWrites: false, port: 23132 });
        expect(DEFAULT_MCP_SERVER_SETTINGS).toEqual(loadMcpSettings());
    });

    it('are saved and read back', () => {
        saveMcpSettings({ enabled: true, allowWrites: true, port: 23133 });
        expect(loadMcpSettings()).toEqual({ enabled: true, allowWrites: true, port: 23133 });
    });

    it('live in the local kv cache, which is not synced to other computers', () => {
        saveMcpSettings({ enabled: true, allowWrites: false, port: 23132 });
        const kvTable = getTableConfig(kvCache).name;

        expect(SYNCED_TABLE_NAMES.has(kvTable)).toBe(false);
        expect(
            db.sqlite.prepare(`SELECT key FROM ${kvTable} WHERE key = ?`).get(MCP_SETTINGS_KEY),
        ).toEqual({ key: MCP_SETTINGS_KEY });
        expect(db.syncSqlite.prepare('SELECT COUNT(*) AS n FROM change_logs').get()).toEqual({
            n: 0,
        });
    });

    it('fall back field by field when the stored value is damaged', () => {
        kvRepo.set(MCP_SETTINGS_KEY, { enabled: 'yes', allowWrites: true, port: 80 });
        expect(loadMcpSettings()).toEqual({ enabled: false, allowWrites: true, port: 23132 });

        kvRepo.set(MCP_SETTINGS_KEY, 'not an object');
        expect(loadMcpSettings()).toEqual(DEFAULT_MCP_SERVER_SETTINGS);
    });
});
