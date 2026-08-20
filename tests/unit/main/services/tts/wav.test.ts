import { describe, it, expect } from 'vitest';
import { decodeWav, encodeWav } from '@main/services/tts/wav';

function ramp(length: number): Float32Array {
    const samples = new Float32Array(length);
    for (let i = 0; i < length; i++) samples[i] = (i / length) * 2 - 1;
    return samples;
}

describe('wav', () => {
    it('round-trips samples through encode and decode', () => {
        const decoded = decodeWav(encodeWav(ramp(500), 22050));

        expect(decoded).not.toBeNull();
        expect(decoded!.sampleRate).toBe(22050);
        expect(decoded!.samples).toHaveLength(500);
        for (let i = 0; i < 500; i++) {
            expect(decoded!.samples[i]).toBeCloseTo(ramp(500)[i], 3);
        }
    });

    it('clamps samples outside the -1..1 range instead of wrapping', () => {
        const decoded = decodeWav(encodeWav(Float32Array.from([-4, 4]), 16000));

        expect(decoded!.samples[0]).toBeCloseTo(-1, 3);
        expect(decoded!.samples[1]).toBeCloseTo(1, 3);
    });

    it('returns null for a buffer that is not RIFF/WAVE', () => {
        expect(decodeWav(Buffer.from('not audio at all'))).toBeNull();
        expect(decodeWav(Buffer.alloc(0))).toBeNull();
    });

    it('returns null for stereo, so callers leave the audio untouched', () => {
        const wav = encodeWav(ramp(100), 44100);
        wav.writeUInt16LE(2, 22);

        expect(decodeWav(wav)).toBeNull();
    });

    it('returns null for a bit depth it cannot read', () => {
        const wav = encodeWav(ramp(100), 44100);
        wav.writeUInt16LE(24, 34);

        expect(decodeWav(wav)).toBeNull();
    });

    it('skips unknown chunks placed before the data chunk', () => {
        const source = encodeWav(ramp(64), 16000);
        const extra = Buffer.alloc(12);
        extra.write('LIST', 0);
        extra.writeUInt32LE(4, 4);
        const wav = Buffer.concat([source.subarray(0, 36), extra, source.subarray(36)]);
        wav.writeUInt32LE(wav.length - 8, 4);

        const decoded = decodeWav(wav);

        expect(decoded).not.toBeNull();
        expect(decoded!.samples).toHaveLength(64);
    });
});
