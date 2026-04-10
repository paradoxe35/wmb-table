import { once } from 'node:events';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { downloadResumableFile, replaceFileAtomically } from '@main/lib/resumable-download';

const FILE_BYTES = Buffer.from('abcdefghijklmnopqrstuvwxyz0123456789');

let server: http.Server;
let downloadUrl = '';
let rangeRequests: string[] = [];
let fullGetRequests = 0;

function buildRangeResponse(rangeHeader: string): { start: number } | null {
    const match = /^bytes=(\d+)-$/i.exec(rangeHeader);
    if (!match) {
        return null;
    }

    const start = Number(match[1]);
    return Number.isFinite(start) ? { start } : null;
}

beforeAll(async () => {
    server = http.createServer((req, res) => {
        if (req.url !== '/file.bin') {
            res.statusCode = 404;
            res.end();
            return;
        }

        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', 'application/octet-stream');

        if (req.method === 'HEAD') {
            res.setHeader('Content-Length', String(FILE_BYTES.length));
            res.statusCode = 200;
            res.end();
            return;
        }

        const rangeHeader = req.headers.range;
        if (typeof rangeHeader === 'string') {
            rangeRequests.push(rangeHeader);
            const parsed = buildRangeResponse(rangeHeader);
            if (!parsed || parsed.start >= FILE_BYTES.length) {
                res.statusCode = 416;
                res.setHeader('Content-Range', `bytes */${FILE_BYTES.length}`);
                res.end();
                return;
            }

            res.statusCode = 206;
            res.setHeader('Content-Length', String(FILE_BYTES.length - parsed.start));
            res.setHeader(
                'Content-Range',
                `bytes ${parsed.start}-${FILE_BYTES.length - 1}/${FILE_BYTES.length}`,
            );
            res.end(FILE_BYTES.subarray(parsed.start));
            return;
        }

        fullGetRequests += 1;
        res.statusCode = 200;
        res.setHeader('Content-Length', String(FILE_BYTES.length));
        res.end(FILE_BYTES);
    });

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to resolve test server address.');
    }

    downloadUrl = `http://127.0.0.1:${address.port}/file.bin`;
});

afterAll(async () => {
    server.close();
    await once(server, 'close');
});

beforeEach(() => {
    rangeRequests = [];
    fullGetRequests = 0;
});

describe('resumable-download', () => {
    it('resumes from an existing partial file', async () => {
        const workDir = await mkdtemp(join(tmpdir(), 'wmb-resume-'));
        const destinationPath = join(workDir, 'file.bin.download');

        try {
            await writeFile(destinationPath, FILE_BYTES.subarray(0, 10));

            const result = await downloadResumableFile({
                url: downloadUrl,
                destinationPath,
                progressThrottleMs: 1,
            });

            expect(result.resumed).toBe(true);
            expect(result.resumable).toBe(true);
            expect(rangeRequests).toContain('bytes=10-');
            await expect(readFile(destinationPath)).resolves.toEqual(FILE_BYTES);
        } finally {
            await rm(workDir, { recursive: true, force: true });
        }
    });

    it('drops an invalid stale partial file and retries from scratch', async () => {
        const workDir = await mkdtemp(join(tmpdir(), 'wmb-resume-stale-'));
        const destinationPath = join(workDir, 'file.bin.download');

        try {
            await writeFile(
                destinationPath,
                Buffer.concat([FILE_BYTES, Buffer.from('stale-data')]),
            );

            const result = await downloadResumableFile({
                url: downloadUrl,
                destinationPath,
                progressThrottleMs: 1,
            });

            expect(result.downloadedBytes).toBe(FILE_BYTES.length);
            expect(rangeRequests).toContain(`bytes=${FILE_BYTES.length + 10}-`);
            await expect(readFile(destinationPath)).resolves.toEqual(FILE_BYTES);
        } finally {
            await rm(workDir, { recursive: true, force: true });
        }
    });

    it('replaces the target file atomically', async () => {
        const workDir = await mkdtemp(join(tmpdir(), 'wmb-atomic-'));
        const sourcePath = join(workDir, 'source.tmp');
        const targetPath = join(workDir, 'target.bin');

        try {
            await writeFile(sourcePath, 'new-content');
            await writeFile(targetPath, 'old-content');

            await replaceFileAtomically(sourcePath, targetPath);

            await expect(readFile(targetPath, 'utf8')).resolves.toBe('new-content');
        } finally {
            await rm(workDir, { recursive: true, force: true });
        }
    });

    it('reuses an existing complete file when requested', async () => {
        const workDir = await mkdtemp(join(tmpdir(), 'wmb-reuse-complete-'));
        const destinationPath = join(workDir, 'file.bin.download');

        try {
            await writeFile(destinationPath, FILE_BYTES);

            const result = await downloadResumableFile({
                url: downloadUrl,
                destinationPath,
                reuseExistingFile: true,
                progressThrottleMs: 1,
            });

            expect(result.resumed).toBe(true);
            expect(result.downloadedBytes).toBe(FILE_BYTES.length);
            expect(fullGetRequests).toBe(0);
            expect(rangeRequests).toHaveLength(0);
            await expect(readFile(destinationPath)).resolves.toEqual(FILE_BYTES);
        } finally {
            await rm(workDir, { recursive: true, force: true });
        }
    });
});
