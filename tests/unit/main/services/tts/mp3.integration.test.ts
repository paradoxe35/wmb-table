import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { parseMp3Frames } from '@main/services/tts/mp3';
import { trimMp3Silence } from '@main/services/tts/silence';

const FIXTURE = resolve(__dirname, '../../../../../resources/tts/francois-lepicard-voice.mp3');

describe('mp3 frame parsing against a real file', () => {
    let buffer: Buffer;

    beforeAll(() => {
        buffer = readFileSync(FIXTURE);
    });

    it('walks the whole stream without losing sync', () => {
        const frames = parseMp3Frames(buffer);
        const last = frames.at(-1)!;

        expect(frames.length).toBeGreaterThan(100);
        expect(last.offset + last.byteLength).toBe(buffer.length);
    });

    it('produces contiguous frames', () => {
        const frames = parseMp3Frames(buffer);

        for (let i = 1; i < frames.length; i++) {
            expect(frames[i].offset).toBe(frames[i - 1].offset + frames[i - 1].byteLength);
        }
    });

    it(
        'trims to a still-decodable stream no larger than the input',
        { timeout: 30000 },
        async () => {
            const trimmed = await trimMp3Silence({
                audioBase64: buffer.toString('base64'),
                mimeType: 'audio/mpeg',
            });
            const output = Buffer.from(trimmed.audioBase64, 'base64');

            expect(output.length).toBeLessThanOrEqual(buffer.length);
            expect(parseMp3Frames(output).length).toBeGreaterThan(100);
            expect(trimmed.mimeType).toBe('audio/mpeg');
        },
    );

    it('leaves audio it cannot decode untouched', async () => {
        const input = {
            audioBase64: Buffer.from('junk').toString('base64'),
            mimeType: 'audio/mpeg',
        };

        expect(await trimMp3Silence(input)).toEqual(input);
    });
});
