#!/usr/bin/env node
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, '..', 'resources', 'database', 'data.sqlite');
const db = new DatabaseSync(dbPath, { open: true, readOnly: true });

const rows = db.prepare('SELECT code, file_name, url FROM language ORDER BY code').all();

const result = rows.map((r) => ({
    code: r.code,
    fileName: r.file_name,
    url: r.url,
}));

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
db.close();
