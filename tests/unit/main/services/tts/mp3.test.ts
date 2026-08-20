import { describe, it, expect } from 'vitest';
import { parseMp3Frames, sliceMp3BySamples, type Mp3Frame } from '@main/services/tts/mp3';

const MPEG1_L3_128K_44100_LENGTH = 417;

function mpeg1Frame(): Buffer {
    const frame = Buffer.alloc(MPEG1_L3_128K_44100_LENGTH);
    frame[0] = 0xff;
    frame[1] = 0xfb;
    frame[2] = 0x90;
    frame[3] = 0x00;
    return frame;
}

function mpeg1Stream(frameCount: number): Buffer {
    return Buffer.concat(Array.from({ length: frameCount }, mpeg1Frame));
}

function withId3(payload: Buffer, tagBodySize: number): Buffer {
    const header = Buffer.alloc(10 + tagBodySize);
    header.write('ID3', 0);
    header[3] = 3;
    header[9] = tagBodySize;
    return Buffer.concat([header, payload]);
}

describe('parseMp3Frames', () => {
    it('reads every frame of a MPEG1 Layer III stream', () => {
        const frames = parseMp3Frames(mpeg1Stream(5));

        expect(frames).toHaveLength(5);
        expect(frames[0]).toEqual({
            offset: 0,
            byteLength: MPEG1_L3_128K_44100_LENGTH,
            sampleCount: 1152,
        });
        expect(frames[4].offset).toBe(4 * MPEG1_L3_128K_44100_LENGTH);
    });

    it('skips an ID3v2 tag before the first frame', () => {
        const frames = parseMp3Frames(withId3(mpeg1Stream(2), 40));

        expect(frames).toHaveLength(2);
        expect(frames[0].offset).toBe(50);
    });

    it('accounts for the padding bit in frame length', () => {
        const padded = mpeg1Frame();
        padded[2] = 0x92;
        const frames = parseMp3Frames(Buffer.concat([padded, Buffer.alloc(1)]));

        expect(frames[0].byteLength).toBe(MPEG1_L3_128K_44100_LENGTH + 1);
    });

    it('rejects reserved bitrate and sample rate values', () => {
        const freeBitrate = mpeg1Frame();
        freeBitrate[2] = 0x00;
        expect(parseMp3Frames(freeBitrate)).toHaveLength(0);

        const badBitrate = mpeg1Frame();
        badBitrate[2] = 0xf0;
        expect(parseMp3Frames(badBitrate)).toHaveLength(0);

        const badSampleRate = mpeg1Frame();
        badSampleRate[2] = 0x9c;
        expect(parseMp3Frames(badSampleRate)).toHaveLength(0);
    });

    it('ignores layers other than Layer III', () => {
        const layerTwo = mpeg1Frame();
        layerTwo[1] = 0xfd;

        expect(parseMp3Frames(layerTwo)).toHaveLength(0);
    });

    it('resynchronises past garbage between frames', () => {
        const stream = Buffer.concat([mpeg1Frame(), Buffer.from([0x00, 0x11]), mpeg1Frame()]);
        const frames = parseMp3Frames(stream);

        expect(frames).toHaveLength(2);
        expect(frames[1].offset).toBe(MPEG1_L3_128K_44100_LENGTH + 2);
    });

    it('returns nothing for a buffer with no frames', () => {
        expect(parseMp3Frames(Buffer.from('no audio here'))).toHaveLength(0);
    });
});

describe('sliceMp3BySamples', () => {
    const frames: Mp3Frame[] = Array.from({ length: 10 }, (_, i) => ({
        offset: i * 100,
        byteLength: 100,
        sampleCount: 1152,
    }));
    const buffer = Buffer.alloc(1000, 7);

    it('cuts on frame boundaries containing the requested samples', () => {
        const sliced = sliceMp3BySamples(buffer, frames, 1152 * 2, 1152 * 5);

        expect(sliced).not.toBeNull();
        expect(sliced!.length).toBe(400);
        expect(sliced!.byteOffset).toBe(200);
    });

    it('keeps the leading frames when only the tail is trimmed', () => {
        const sliced = sliceMp3BySamples(buffer, frames, 0, 1152 * 3);

        expect(sliced!.byteOffset).toBe(0);
        expect(sliced!.length).toBe(400);
    });

    it('returns null when the bounds already span every frame', () => {
        expect(sliceMp3BySamples(buffer, frames, 0, 1152 * 10 - 1)).toBeNull();
    });

    it('returns null when there are no frames to slice', () => {
        expect(sliceMp3BySamples(buffer, [], 0, 100)).toBeNull();
    });
});
