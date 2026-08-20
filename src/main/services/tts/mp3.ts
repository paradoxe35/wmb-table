export interface Mp3Frame {
    offset: number;
    byteLength: number;
    sampleCount: number;
}

const LAYER_III = 1;
const BITRATES_MPEG1 = [
    0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
] as const;
const BITRATES_MPEG2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0] as const;
const SAMPLE_RATES = {
    mpeg1: [44100, 48000, 32000],
    mpeg2: [22050, 24000, 16000],
    mpeg25: [11025, 12000, 8000],
} as const;

function id3Size(buffer: Buffer): number {
    if (buffer.length < 10 || buffer.toString('ascii', 0, 3) !== 'ID3') return 0;
    const size = (buffer[6] << 21) | (buffer[7] << 14) | (buffer[8] << 7) | buffer[9];
    return 10 + size;
}

function readFrame(buffer: Buffer, offset: number): Mp3Frame | null {
    if (offset + 4 > buffer.length) return null;
    if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) return null;

    const versionBits = (buffer[offset + 1] >> 3) & 0b11;
    const layerBits = (buffer[offset + 1] >> 1) & 0b11;
    if (versionBits === 0b01 || layerBits !== LAYER_III) return null;

    const bitrateIndex = (buffer[offset + 2] >> 4) & 0b1111;
    const sampleRateIndex = (buffer[offset + 2] >> 2) & 0b11;
    if (bitrateIndex === 0 || bitrateIndex === 0b1111 || sampleRateIndex === 0b11) return null;

    const isMpeg1 = versionBits === 0b11;
    const bitrate = (isMpeg1 ? BITRATES_MPEG1 : BITRATES_MPEG2)[bitrateIndex] * 1000;
    const rates =
        versionBits === 0b11
            ? SAMPLE_RATES.mpeg1
            : versionBits === 0b10
              ? SAMPLE_RATES.mpeg2
              : SAMPLE_RATES.mpeg25;
    const sampleRate = rates[sampleRateIndex];
    const padding = (buffer[offset + 2] >> 1) & 1;
    const sampleCount = isMpeg1 ? 1152 : 576;
    const byteLength = Math.floor((sampleCount / 8) * (bitrate / sampleRate)) + padding;

    if (byteLength <= 4 || offset + byteLength > buffer.length) return null;
    return { offset, byteLength, sampleCount };
}

export function parseMp3Frames(buffer: Buffer): Mp3Frame[] {
    const frames: Mp3Frame[] = [];
    let offset = id3Size(buffer);

    while (offset < buffer.length) {
        const frame = readFrame(buffer, offset);
        if (frame) {
            frames.push(frame);
            offset += frame.byteLength;
            continue;
        }

        const nextSync = buffer.indexOf(0xff, offset + 1);
        if (nextSync === -1) break;
        offset = nextSync;
    }

    return frames;
}

/**
 * Cuts on frame boundaries so the retained audio is never re-encoded. Returns null when the
 * bounds already cover every frame.
 */
export function sliceMp3BySamples(
    buffer: Buffer,
    frames: Mp3Frame[],
    startSample: number,
    endSample: number,
): Buffer | null {
    if (frames.length === 0) return null;

    let firstFrame = 0;
    let lastFrame = frames.length - 1;
    let consumed = 0;

    for (let i = 0; i < frames.length; i++) {
        const next = consumed + frames[i].sampleCount;
        if (consumed <= startSample && startSample < next) firstFrame = i;
        if (consumed <= endSample && endSample < next) {
            lastFrame = i;
            break;
        }
        consumed = next;
    }

    if (firstFrame === 0 && lastFrame === frames.length - 1) return null;

    const start = frames[firstFrame].offset;
    const end = frames[lastFrame].offset + frames[lastFrame].byteLength;
    return buffer.subarray(start, end);
}
