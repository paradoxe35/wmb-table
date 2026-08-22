import { createRequire } from 'node:module';
import type * as Ort from 'onnxruntime-common';

export type PocketRuntime = typeof Ort;

let runtime: PocketRuntime | null = null;

/**
 * Native ONNX Runtime, which measures about twice as fast on the flow model as the wasm build.
 * The wasm build also ignores its own thread setting under Node, so there is nothing to gain
 * from carrying it as a fallback: the native package ships binaries for every platform shipped.
 *
 * `require` rather than `import()`: the main bundle is compiled to bytecode and runs through
 * `vm`, which has no dynamic import callback.
 */
export function getRuntime(): PocketRuntime {
    if (!runtime) {
        runtime = createRequire(__filename)('onnxruntime-node') as PocketRuntime;
        runtime.env.logLevel = 'error';
    }
    return runtime;
}
