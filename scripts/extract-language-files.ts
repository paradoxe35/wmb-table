import Database from 'better-sqlite3';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = resolve(__dirname, '..', 'resources', 'database', 'data.sqlite');
const db = new Database(dbPath, { readonly: true });

interface Row {
    code: string;
    file_name: string;
    url: string;
}

const rows = db.prepare('SELECT code, file_name, url FROM language ORDER BY code').all() as Row[];

const result = rows.map((r) => ({
    code: r.code,
    fileName: r.file_name,
    url: r.url,
}));

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
db.close();
