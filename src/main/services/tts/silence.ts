import log from 'electron-log';
import pLimitModule from 'p-limit';
import { MPEGDecoder } from 'mpg123-decoder';
import { resolveDefaultExport } from '@main/lib/module-interop';
import type { TtsSynthesizeResult } from '@shared/tts.types';
import { decodeWav, encodeWav, type DecodedAudio } from './wav';
import { parseMp3Frames, sliceMp3BySamples } from './mp3';

const pLimit = resolveDefaultExport(pLimitModule);

const SILENCE_THRESHOLD = 0.005;
const SILENCE_PAD_MS = 30;

export interface SilenceBounds {
    startSample: number;
    endSample: number;
}

/** Null when the clip is silent throughout, so it never becomes zero-length audio. */
export function findSilenceBounds(samples: Float32Array, sampleRate: number): SilenceBounds | null {
    let start = 0;
    let end = samples.length - 1;

    while (start < samples.length && Math.abs(samples[start]) < SILENCE_THRESHOLD) start++;
    while (end > start && Math.abs(samples[end]) < SILENCE_THRESHOLD) end--;
    if (start >= end) return null;

    const pad = Math.round((SILENCE_PAD_MS / 1000) * sampleRate);
    return {
        startSample: Math.max(0, start - pad),
        endSample: Math.min(samples.length - 1, end + pad),
    };
}

function coversWholeClip(bounds: SilenceBounds, sampleCount: number): boolean {
    return bounds.startSample === 0 && bounds.endSample === sampleCount - 1;
}

export async function trimWavSilence(result: TtsSynthesizeResult): Promise<TtsSynthesizeResult> {
    const decoded = decodeWav(Buffer.from(result.audioBase64, 'base64'));
    if (!decoded) return result;

    const bounds = findSilenceBounds(decoded.samples, decoded.sampleRate);
    if (!bounds || coversWholeClip(bounds, decoded.samples.length)) return result;

    const trimmed = decoded.samples.subarray(bounds.startSample, bounds.endSample + 1);
    return {
        ...result,
        audioBase64: encodeWav(trimmed, decoded.sampleRate).toString('base64'),
    };
}

const decodeLimit = pLimit(1);
let decoder: MPEGDecoder | null = null;

async function decodeMp3(data: Buffer): Promise<DecodedAudio | null> {
    return decodeLimit(async () => {
        try {
            decoder ??= new MPEGDecoder();
            await decoder.ready;
            await decoder.reset();

            const { channelData, samplesDecoded, sampleRate } = decoder.decode(data);
            if (!samplesDecoded || channelData.length === 0) return null;
            return { samples: channelData[0], sampleRate };
        } catch (error) {
            log.warn('MP3 decode for silence trimming failed', error);
            return null;
        }
    });
}

export async function trimMp3Silence(result: TtsSynthesizeResult): Promise<TtsSynthesizeResult> {
    const buffer = Buffer.from(result.audioBase64, 'base64');
    const decoded = await decodeMp3(buffer);
    if (!decoded) return result;

    const bounds = findSilenceBounds(decoded.samples, decoded.sampleRate);
    if (!bounds || coversWholeClip(bounds, decoded.samples.length)) return result;

    const frames = parseMp3Frames(buffer);
    const trimmed = sliceMp3BySamples(buffer, frames, bounds.startSample, bounds.endSample);
    if (!trimmed) return result;

    return { ...result, audioBase64: trimmed.toString('base64') };
}

export function disposeSilenceTrimming(): void {
    decoder?.free();
    decoder = null;
}
