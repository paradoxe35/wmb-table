import type { Tensor, InferenceSession } from 'onnxruntime-web';
import type { PocketStateEntry, PocketTensor } from './types';

export type ModelState = Record<string, Tensor>;

type TensorFactory = (
    dtype: 'float32' | 'int64' | 'bool',
    data: unknown,
    shape: number[],
) => Tensor;

function emptyData(entry: PocketStateEntry): Float32Array | BigInt64Array | Uint8Array {
    const size = entry.shape.reduce((total, dim) => total * dim, 1);

    if (entry.dtype === 'int64') return new BigInt64Array(size);
    if (entry.dtype === 'bool') return new Uint8Array(size);

    const data = new Float32Array(size);
    if (entry.fill === 'nan') data.fill(Number.NaN);
    else if (entry.fill === 'ones') data.fill(1);
    return data;
}

export function initState(manifest: PocketStateEntry[], tensor: TensorFactory): ModelState {
    const state: ModelState = {};
    for (const entry of manifest) {
        state[entry.input_name] = tensor(entry.dtype, emptyData(entry), entry.shape);
    }
    return state;
}

export function applyOutputs(
    state: ModelState,
    outputs: InferenceSession.OnnxValueMapType,
    manifest: PocketStateEntry[],
): void {
    for (const entry of manifest) {
        const value = outputs[entry.output_name];
        if (value) state[entry.input_name] = value as Tensor;
    }
}

function strides(shape: number[]): number[] {
    const result = new Array<number>(shape.length);
    let stride = 1;
    for (let i = shape.length - 1; i >= 0; i--) {
        result[i] = stride;
        stride *= shape[i];
    }
    return result;
}

/**
 * A voice record is captured at a different run length than the model expects, so the
 * overlapping region is copied element-wise and everything beyond it keeps the manifest
 * fill, which is how unused cache slots stay marked.
 */
function fitToShape(source: PocketTensor, entry: PocketStateEntry): Float32Array {
    const target = emptyData(entry) as Float32Array;
    const size = entry.shape.reduce((total, dim) => total * dim, 1);

    if (source.data.length === size) return Float32Array.from(source.data);
    if (source.shape.length !== entry.shape.length) return target;

    const sourceStrides = strides(source.shape);
    const targetStrides = strides(entry.shape);
    const bounds = source.shape.map((dim, i) => Math.min(dim, entry.shape[i]));
    if (bounds.some((dim) => dim === 0)) return target;

    const cursor = new Array<number>(source.shape.length).fill(0);
    for (;;) {
        let from = 0;
        let to = 0;
        for (let i = 0; i < cursor.length; i++) {
            from += cursor[i] * sourceStrides[i];
            to += cursor[i] * targetStrides[i];
        }
        target[to] = source.data[from];

        let dim = cursor.length - 1;
        for (; dim >= 0; dim--) {
            if (++cursor[dim] < bounds[dim]) break;
            cursor[dim] = 0;
        }
        if (dim < 0) return target;
    }
}

function deriveStep(module: Record<string, PocketTensor>): PocketTensor | undefined {
    const source = module.step ?? (module.end_offset ? undefined : module.offset);
    if (source) return source;
    if (module.current_end)
        return { data: Float32Array.of(module.current_end.shape[0]), shape: [1] };
    return undefined;
}

export function stateFromVoice(
    voice: Record<string, PocketTensor>,
    manifest: PocketStateEntry[],
    tensor: TensorFactory,
): ModelState {
    const byModule: Record<string, Record<string, PocketTensor>> = {};
    for (const [path, value] of Object.entries(voice)) {
        const slash = path.indexOf('/');
        if (slash === -1) continue;
        const module = path.slice(0, slash);
        (byModule[module] ??= {})[path.slice(slash + 1)] = value;
    }

    const state = initState(manifest, tensor);
    for (const entry of manifest) {
        const module = byModule[entry.module] ?? {};
        const source = module[entry.key] ?? (entry.key === 'step' ? deriveStep(module) : undefined);
        if (!source) continue;

        if (entry.dtype === 'int64') {
            state[entry.input_name] = tensor(
                'int64',
                BigInt64Array.of(BigInt(Math.trunc(source.data[0] ?? 0))),
                entry.shape,
            );
            continue;
        }
        state[entry.input_name] = tensor(entry.dtype, fitToShape(source, entry), entry.shape);
    }
    return state;
}
