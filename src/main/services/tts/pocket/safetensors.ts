import type { PocketTensor } from './types';

const HEADER_SIZE_BYTES = 8;

interface Entry {
    dtype: string;
    shape: number[];
    data_offsets: [number, number];
}

/**
 * Voice embeddings arrive as safetensors whose keys are the `path` of a state manifest entry,
 * so the record can be matched straight onto the model state.
 */
export function parseSafetensors(buffer: ArrayBuffer): Record<string, PocketTensor> {
    const view = new DataView(buffer);
    const headerLength = Number(view.getBigUint64(0, true));
    const header = JSON.parse(
        new TextDecoder().decode(new Uint8Array(buffer, HEADER_SIZE_BYTES, headerLength)),
    ) as Record<string, Entry | unknown>;

    const dataStart = HEADER_SIZE_BYTES + headerLength;
    const tensors: Record<string, PocketTensor> = {};

    for (const [name, raw] of Object.entries(header)) {
        if (name === '__metadata__') continue;
        const entry = raw as Entry;
        const [begin, end] = entry.data_offsets;
        tensors[name] = {
            data: toFloat32(buffer.slice(dataStart + begin, dataStart + end), entry.dtype),
            shape: entry.shape,
        };
    }

    return tensors;
}

function toFloat32(slice: ArrayBuffer, dtype: string): Float32Array {
    switch (dtype) {
        case 'F32':
            return new Float32Array(slice);
        case 'F16':
            return fromFloat16(new Uint16Array(slice));
        case 'I64': {
            const source = new BigInt64Array(slice);
            return Float32Array.from(source, Number);
        }
        default:
            throw new Error(`Type de tenseur non pris en charge: ${dtype}`);
    }
}

function fromFloat16(source: Uint16Array): Float32Array {
    const target = new Float32Array(source.length);
    for (let i = 0; i < source.length; i++) {
        const half = source[i];
        const sign = (half & 0x8000) >> 15;
        const exponent = (half & 0x7c00) >> 10;
        const fraction = half & 0x03ff;

        let value: number;
        if (exponent === 0) {
            value = fraction * 2 ** -24;
        } else if (exponent === 0x1f) {
            value = fraction ? Number.NaN : Number.POSITIVE_INFINITY;
        } else {
            value = (1 + fraction / 1024) * 2 ** (exponent - 15);
        }
        target[i] = sign ? -value : value;
    }
    return target;
}
