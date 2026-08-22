/** Linear resampling is enough for a voice prompt: the codec only needs the timbre. */
export function resample(samples: Float32Array, from: number, to: number): Float32Array {
    if (from === to || samples.length === 0) return samples;

    const ratio = from / to;
    const length = Math.floor(samples.length / ratio);
    const output = new Float32Array(length);

    for (let i = 0; i < length; i++) {
        const position = i * ratio;
        const index = Math.floor(position);
        const next = Math.min(index + 1, samples.length - 1);
        const fraction = position - index;
        output[i] = samples[index] * (1 - fraction) + samples[next] * fraction;
    }
    return output;
}
