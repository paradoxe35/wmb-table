export interface DecodedAudio {
    samples: Float32Array;
    sampleRate: number;
}

const HEADER_SIZE = 44;
const PCM_FORMAT = 1;
const BITS_PER_SAMPLE = 16;

export function encodeWav(samples: Float32Array, sampleRate: number): Buffer {
    const numChannels = 1;
    const byteRate = (sampleRate * numChannels * BITS_PER_SAMPLE) / 8;
    const blockAlign = (numChannels * BITS_PER_SAMPLE) / 8;
    const dataSize = samples.length * 2;
    const buffer = Buffer.alloc(HEADER_SIZE + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(PCM_FORMAT, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(sample < 0 ? sample * 0x8000 : sample * 0x7fff, HEADER_SIZE + i * 2);
    }

    return buffer;
}

/** Returns null for anything that is not mono 16-bit PCM, so callers can leave the audio alone. */
export function decodeWav(buffer: Buffer): DecodedAudio | null {
    if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
    if (buffer.toString('ascii', 8, 12) !== 'WAVE') return null;

    let sampleRate = 0;
    let numChannels = 0;
    let bitsPerSample = 0;
    let offset = 12;

    while (offset + 8 <= buffer.length) {
        const chunkId = buffer.toString('ascii', offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);
        const body = offset + 8;

        if (chunkId === 'fmt ' && body + 16 <= buffer.length) {
            if (buffer.readUInt16LE(body) !== PCM_FORMAT) return null;
            numChannels = buffer.readUInt16LE(body + 2);
            sampleRate = buffer.readUInt32LE(body + 4);
            bitsPerSample = buffer.readUInt16LE(body + 14);
        } else if (chunkId === 'data') {
            if (numChannels !== 1 || bitsPerSample !== BITS_PER_SAMPLE || sampleRate <= 0) {
                return null;
            }

            const available = Math.min(chunkSize, buffer.length - body);
            const count = Math.floor(available / 2);
            const samples = new Float32Array(count);
            for (let i = 0; i < count; i++) {
                samples[i] = buffer.readInt16LE(body + i * 2) / 0x8000;
            }
            return { samples, sampleRate };
        }

        offset = body + chunkSize + (chunkSize % 2);
    }

    return null;
}
