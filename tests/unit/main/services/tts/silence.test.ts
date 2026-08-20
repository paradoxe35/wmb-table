import { describe, it, expect } from 'vitest';
import { findSilenceBounds, trimWavSilence } from '@main/services/tts/silence';
import { decodeWav, encodeWav } from '@main/services/tts/wav';

const SAMPLE_RATE = 16000;
const PAD_SAMPLES = Math.round(0.03 * SAMPLE_RATE);

function clip({ lead = 0, speech = 0, tail = 0 }): Float32Array {
    const samples = new Float32Array(lead + speech + tail);
    for (let i = lead; i < lead + speech; i++) samples[i] = 0.5;
    return samples;
}

function toResult(samples: Float32Array) {
    return {
        audioBase64: encodeWav(samples, SAMPLE_RATE).toString('base64'),
        mimeType: 'audio/wav',
    };
}

describe('findSilenceBounds', () => {
    it('finds speech surrounded by silence and keeps a pad on each side', () => {
        const bounds = findSilenceBounds(
            clip({ lead: 8000, speech: 1000, tail: 8000 }),
            SAMPLE_RATE,
        );

        expect(bounds).toEqual({
            startSample: 8000 - PAD_SAMPLES,
            endSample: 8999 + PAD_SAMPLES,
        });
    });

    it('clamps the pad to the clip instead of running past either edge', () => {
        const bounds = findSilenceBounds(clip({ lead: 10, speech: 100, tail: 10 }), SAMPLE_RATE);

        expect(bounds).toEqual({ startSample: 0, endSample: 119 });
    });

    it('returns null when the whole clip is below the threshold', () => {
        expect(findSilenceBounds(new Float32Array(4000), SAMPLE_RATE)).toBeNull();
    });

    it('returns null for an empty clip', () => {
        expect(findSilenceBounds(new Float32Array(0), SAMPLE_RATE)).toBeNull();
    });

    it('treats very quiet noise as silence', () => {
        const samples = clip({ lead: 2000, speech: 500, tail: 2000 });
        for (let i = 0; i < 2000; i++) samples[i] = 0.001;

        expect(findSilenceBounds(samples, SAMPLE_RATE)!.startSample).toBe(2000 - PAD_SAMPLES);
    });

    it('detects speech that is negative-going', () => {
        const samples = new Float32Array(3000);
        for (let i = 1000; i < 1100; i++) samples[i] = -0.5;

        expect(findSilenceBounds(samples, SAMPLE_RATE)!.startSample).toBe(1000 - PAD_SAMPLES);
    });
});

describe('trimWavSilence', () => {
    it('shortens a padded clip to the speech plus padding', async () => {
        const trimmed = await trimWavSilence(
            toResult(clip({ lead: 8000, speech: 1000, tail: 8000 })),
        );
        const decoded = decodeWav(Buffer.from(trimmed.audioBase64, 'base64'));

        expect(decoded!.samples).toHaveLength(1000 + PAD_SAMPLES * 2);
        expect(decoded!.sampleRate).toBe(SAMPLE_RATE);
    });

    it('preserves the speech itself', async () => {
        const trimmed = await trimWavSilence(
            toResult(clip({ lead: 5000, speech: 200, tail: 5000 })),
        );
        const decoded = decodeWav(Buffer.from(trimmed.audioBase64, 'base64'));
        const loud = [...decoded!.samples].filter((s) => Math.abs(s) > 0.4);

        expect(loud).toHaveLength(200);
    });

    it('leaves a silent clip untouched rather than emptying it', async () => {
        const input = toResult(new Float32Array(4000));

        expect(await trimWavSilence(input)).toEqual(input);
    });

    it('leaves a clip with no silence to trim untouched', async () => {
        const input = toResult(clip({ speech: 4000 }));

        expect(await trimWavSilence(input)).toEqual(input);
    });

    it('leaves audio it cannot decode untouched', async () => {
        const input = {
            audioBase64: Buffer.from('junk').toString('base64'),
            mimeType: 'audio/wav',
        };

        expect(await trimWavSilence(input)).toEqual(input);
    });

    it('keeps the mime type of the input', async () => {
        const trimmed = await trimWavSilence(
            toResult(clip({ lead: 8000, speech: 500, tail: 8000 })),
        );

        expect(trimmed.mimeType).toBe('audio/wav');
    });
});
